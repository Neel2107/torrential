import type { VideoPlayer, VideoPlayerStatus } from 'expo-video';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { recover, WATCHING, type Recovery } from '@web/player/recovery';
import type { Job, PlayInfo, Release } from '@web/wire';

import { useLink } from '@/engine/session';
import { Button } from '@/ui/Button';
import { color, font, motion, radius, space } from '@/theme';

import { replaceStalled, useViewer } from './start';

const SWITCHED_MS = 6000;
const SAMPLE_MS = 1000;

export type Takeover = { play: PlayInfo; release: Release; at: number };

export function useStallRecovery({
  video,
  play,
  job,
  player,
  status,
  held,
  now,
  onTakeover,
}: {
  video: string | null;
  play: PlayInfo;
  job: Job;
  player: VideoPlayer;
  status: VideoPlayerStatus;
  held: { current: boolean };
  now: () => number;
  onTakeover: (takeover: Takeover) => void;
}): { recovery: Recovery; retry: () => void } {
  const link = useLink();
  const viewer = useViewer();
  const [recovery, dispatch] = useReducer(recover, WATCHING);
  const seen = useRef({ job, status });
  seen.current = { job, status };
  const latest = useRef({ now, onTakeover, viewer });
  latest.current = { now, onTakeover, viewer };

  useEffect(() => {
    if (!video) return;
    const timer = setInterval(() => {
      const { job, status } = seen.current;
      const time = player.currentTime;
      dispatch({
        type: 'sample',
        now: Date.now(),
        time,
        waiting: status === 'loading' && !held.current,
        ahead: Math.max(0, player.bufferedPosition - time),
        receiving: job.progress.down_rate > 0 || job.state === 'done',
        failed: job.state === 'error',
      });
    }, SAMPLE_MS);
    return () => clearInterval(timer);
  }, [video, player, held]);

  const switching = recovery.kind === 'switching';
  useEffect(() => {
    if (!switching || !video) return;
    const stop = new AbortController();
    replaceStalled(link, { video, stalled: play.id, viewer: latest.current.viewer }, stop.signal).then(
      (outcome) => {
        if ('error' in outcome) return dispatch({ type: 'failed', error: outcome.error });
        dispatch({ type: 'playing' });
        latest.current.onTakeover({ ...outcome, at: latest.current.now() });
      },
      () => {},
    );
    return () => stop.abort();
  }, [switching, video, link, play.id]);

  return { recovery, retry: () => dispatch({ type: 'retry', now: Date.now() }) };
}

export function RecoveryNotice({
  recovery,
  switched,
  onRetry,
}: {
  recovery: Recovery;
  switched: boolean;
  onRetry: () => void;
}) {
  const [showSwitched, setShowSwitched] = useState(switched);
  useEffect(() => {
    if (!showSwitched) return;
    const timer = setTimeout(() => setShowSwitched(false), SWITCHED_MS);
    return () => clearTimeout(timer);
  }, [showSwitched]);

  const notice =
    recovery.kind === 'switching' ? (
      <>
        <ActivityIndicator size="small" color={color.ink} />
        <Text style={styles.text}>This source stopped sending video. Trying another one.</Text>
      </>
    ) : recovery.kind === 'exhausted' ? (
      <>
        <Text style={styles.text}>No other source plays right now. Still waiting on this one.</Text>
        <Button label="Look again" kind="quiet" onPress={onRetry} />
      </>
    ) : showSwitched ? (
      <Text style={styles.text}>Switched to another source.</Text>
    ) : null;
  if (!notice) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View
        key={recovery.kind}
        entering={FadeIn.duration(motion.quick)}
        exiting={FadeOut.duration(motion.quick)}
        style={styles.pill}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        {notice}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: '16%', left: space.lg, right: space.lg, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    maxWidth: 560,
    paddingVertical: space.xs,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  text: {
    flexShrink: 1,
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 19,
    color: color.ink,
    paddingRight: space.md,
  },
});
