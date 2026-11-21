import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clock, sentence } from '@web/lib/format';
import { titleOf } from '@web/lib/video';
import type { Cast, CastAction, CastStart, Tv } from '@web/wire';

import { EngineError, post } from '@/engine/client';
import { findTvs, keys, useTvs } from '@/engine/queries';
import { useLink } from '@/engine/session';
import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { rise } from '@/ui/rise';
import { Tap } from '@/ui/Tap';
import { color, font, motion, radius, space, type } from '@/theme';

const CONTAINERS: Record<string, string> = {
  mkv: 'MKV',
  mp4: 'MP4',
  webm: 'WebM',
  avi: 'AVI',
  ts: 'TS',
  mov: 'MOV',
  mpeg: 'MPEG',
  wmv: 'WMV',
};
const DECODES = { 'hevc-hdr': '4K HDR', hevc: '4K', h264: 'HD' } as const;

export default function TvScreen() {
  const params = useLocalSearchParams<{ video?: string; ref?: string; file?: string; at?: string }>();
  const link = useLink();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [scanning, setScanning] = useState(true);
  const live = (cast: Cast) => cast.state !== 'ended';
  const tvs = useTvs(true);
  const casts = tvs.data?.casts ?? [];
  const current = casts.find(live) ?? null;
  const startAt = params.at ? Number(params.at) : undefined;
  const what = params.video
    ? { video: params.video, start_at: startAt }
    : params.ref
      ? { ref: params.ref, file: params.file ? Number(params.file) : undefined, start_at: startAt }
      : null;
  const [problem, setProblem] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    findTvs(link, true)
      .then((list) => !cancelled && client.setQueryData([...keys.tvs, link.base], list))
      .finally(() => !cancelled && setScanning(false));
    return () => {
      cancelled = true;
    };
  }, [client, link]);

  const start = async (tv: Tv) => {
    if (!what) return;
    setStarting(tv.id);
    setProblem(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body: CastStart = { tv: tv.id, ...what };
      await post<{ cast: Cast }>(link, '/api/cast', body);
      await client.invalidateQueries({ queryKey: keys.tvs });
    } catch (error) {
      setProblem(error instanceof EngineError ? sentence(error.message) : 'Could not reach the engine.');
    } finally {
      setStarting(null);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.lg }}
    >
      {current ? (
        <Remote cast={current} />
      ) : (
        <>
          <View style={styles.headingRow}>
            <Text style={type.display}>Play on TV</Text>
            <Radar active={scanning} />
          </View>
          <Text style={type.body}>
            {what
              ? 'Pick a TV. Your phone becomes the remote.'
              : 'TVs on your home network. Open a film or an episode to play it on one.'}
          </Text>
          {problem ? (
            <View style={styles.problem}>
              <Icon name={icons.warning} size={18} tint={color.error} />
              <Text style={[type.label, { color: color.error, flex: 1 }]}>{problem}</Text>
            </View>
          ) : null}
          <View style={{ gap: space.sm }}>
            {(tvs.data?.tvs ?? []).map((tv, index) => (
              <Animated.View key={tv.id} entering={rise(index)}>
                <Tap
                  shrink={0.98}
                  highlight
                  disabled={!what || starting !== null}
                  onPress={() => start(tv)}
                  accessibilityLabel={`Play on ${tv.name}`}
                  style={styles.tvRow}
                >
                  <View style={styles.tvIcon}>
                    <Icon name={icons.tv} size={22} tint={color.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={type.callout} numberOfLines={1}>
                      {tv.name}
                    </Text>
                    <Text style={type.caption} numberOfLines={1}>
                      {[
                        tv.address.replace(/^https?:\/\//, '').replace(/[:/].*$/, ''),
                        DECODES[tv.decodes],
                        tv.plays.map((c) => CONTAINERS[c] ?? c).join(', '),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {starting === tv.id ? (
                    <ActivityIndicator color={color.action} />
                  ) : what ? (
                    <Icon name={icons.chevron} size={18} tint={color.pencil} />
                  ) : null}
                </Tap>
              </Animated.View>
            ))}
            {!scanning && (tvs.data?.tvs.length ?? 0) === 0 ? (
              <Animated.View entering={FadeIn} style={styles.none}>
                <Text style={type.headline}>No TVs found</Text>
                <Text style={type.label}>
                  The TV has to be on, on the same network as the computer running torrential, with DLNA or screen
                  sharing turned on.
                </Text>
                <Button
                  label="Look again"
                  kind="secondary"
                  icon={icons.refresh}
                  onPress={() => {
                    setScanning(true);
                    findTvs(link, true)
                      .then((list) => client.setQueryData([...keys.tvs, link.base], list))
                      .finally(() => setScanning(false));
                  }}
                  style={{ alignSelf: 'flex-start', marginTop: space.sm }}
                />
              </Animated.View>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Two rings spreading from the corner while the engine searches the network. */
function Radar({ active }: { active: boolean }) {
  return (
    <View style={styles.radar} accessibilityLabel={active ? 'Looking for TVs' : undefined}>
      {active ? (
        <>
          <Ring delay={0} />
          <Ring delay={700} />
        </>
      ) : null}
      <Icon name={icons.cast} size={22} tint={active ? color.action : color.pencil} />
    </View>
  );
}

function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.value), transform: [{ scale: 0.6 + t.value * 1.4 }] }));
  return <Animated.View style={[styles.ring, style]} />;
}

function Remote({ cast }: { cast: Cast }) {
  const link = useLink();
  const client = useQueryClient();
  const [preview, setPreview] = useState<number | null>(null);
  const position = preview ?? cast.position ?? 0;
  const duration = cast.duration ?? 0;
  const playing = cast.state === 'playing';

  const control = async (action: CastAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await post(link, '/api/cast/control', { tv: cast.tv, ...action }).catch(() => {});
    client.invalidateQueries({ queryKey: keys.tvs });
  };

  return (
    <Animated.View entering={rise(0)} style={{ gap: space.xl }}>
      <View style={styles.nowRow}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {cast.state === 'finding' || cast.state === 'loading' ? 'Starting' : playing ? 'Playing' : 'Paused'}
          </Text>
        </View>
        <Text style={type.label} numberOfLines={1}>
          on {cast.tv_name}
        </Text>
      </View>
      <View style={styles.cover}>
        {cast.video ? (
          <Art id={titleOf(cast.video)} kind="background" name={cast.name} style={StyleSheet.absoluteFill} />
        ) : null}
      </View>
      <Text style={type.title} numberOfLines={2}>
        {cast.name}
      </Text>

      <View style={{ gap: space.sm }}>
        <Scrub
          position={position}
          duration={duration}
          onPreview={setPreview}
          onSeek={(seconds) => control({ action: 'seek', position: seconds })}
        />
        <View style={styles.times}>
          <Text style={type.numeric}>{clock(position)}</Text>
          <Text style={type.numeric}>-{clock(Math.max(0, duration - position))}</Text>
        </View>
      </View>

      <View style={styles.transport}>
        <Tap
          shrink={0.86}
          onPress={() => control({ action: 'seek', position: Math.max(0, position - 30) })}
          accessibilityLabel="Back 30 seconds"
          style={styles.transportSide}
        >
          <Icon name={icons.rewind} size={30} tint={color.ink} />
        </Tap>
        <Tap
          shrink={0.9}
          onPress={() => control({ action: playing ? 'pause' : 'resume' })}
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={styles.transportMain}
        >
          <Icon name={playing ? icons.pause : icons.play} size={34} tint={color.actionInk} filled />
        </Tap>
        <Tap
          shrink={0.86}
          onPress={() => control({ action: 'seek', position: Math.min(duration, position + 30) })}
          accessibilityLabel="Forward 30 seconds"
          style={styles.transportSide}
        >
          <Icon name={icons.forward} size={30} tint={color.ink} />
        </Tap>
      </View>

      <View style={styles.bottomRow}>
        {cast.volume !== null ? (
          <View style={styles.volume}>
            <Tap
              shrink={0.86}
              onPress={() => control({ action: 'volume', level: Math.max(0, (cast.volume ?? 0) - 5) })}
              accessibilityLabel="Volume down"
              style={styles.volumeButton}
            >
              <Icon name={icons.volumeDown} size={22} tint={color.ink} />
            </Tap>
            <Text style={[type.numeric, { minWidth: 28, textAlign: 'center' }]}>{cast.volume}</Text>
            <Tap
              shrink={0.86}
              onPress={() => control({ action: 'volume', level: Math.min(100, (cast.volume ?? 0) + 5) })}
              accessibilityLabel="Volume up"
              style={styles.volumeButton}
            >
              <Icon name={icons.volumeUp} size={22} tint={color.ink} />
            </Tap>
          </View>
        ) : (
          <View />
        )}
        <Button
          label="Stop"
          kind="secondary"
          icon={icons.stop}
          onPress={async () => {
            await control({ action: 'stop' });
            router.back();
          }}
        />
      </View>
    </Animated.View>
  );
}

function Scrub({
  position,
  duration,
  onPreview,
  onSeek,
}: {
  position: number;
  duration: number;
  onPreview: (seconds: number | null) => void;
  onSeek: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  const at = (x: number) => Math.max(0, Math.min(duration, (x / width) * duration));
  return (
    <View
      style={styles.scrub}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(event) => onPreview(at(event.nativeEvent.locationX))}
      onResponderMove={(event) => onPreview(at(event.nativeEvent.locationX))}
      onResponderRelease={(event) => {
        onSeek(at(event.nativeEvent.locationX));
        onPreview(null);
      }}
      accessibilityRole="adjustable"
      accessibilityLabel="Position on the TV"
    >
      <View style={styles.scrubTrack} pointerEvents="none">
        <View style={[styles.scrubFill, { width: `${fraction * 100}%` }]} />
      </View>
      <View style={[styles.scrubKnob, { left: fraction * width - 9 }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.raised },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: color.action },
  problem: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(226,128,110,0.12)',
  },
  tvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.lifted,
  },
  tvIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  none: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.lifted },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(166,199,154,0.16)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.action },
  liveText: { fontFamily: font.semibold, fontSize: 12, color: color.action, letterSpacing: 0.3 },
  cover: { aspectRatio: 16 / 9, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.lifted },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  scrub: { height: 28, justifyContent: 'center' },
  scrubTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(240,233,220,0.16)', overflow: 'hidden' },
  scrubFill: { height: 5, backgroundColor: color.action },
  scrubKnob: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: color.ink },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  transportSide: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  transportMain: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.action,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.lifted,
    padding: 4,
  },
  volumeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
