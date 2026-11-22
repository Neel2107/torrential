import { router, useLocalSearchParams } from 'expo-router';
import { useEvent } from 'expo';
import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VttParser, type Cue } from '@web/player/vtt';

import { useCopy, type Copy } from '@/offline/saved';
import { usePlayerPreferences } from '@/player/preferences';
import { SubtitleOverlay } from '@/player/Subtitles';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { Stage } from '@/ui/stage';
import { Tap } from '@/ui/Tap';
import { stage as color, font, space, stageType as type } from '@/theme';

const KEEP_EVERY_MS = 5000;
const ENDING_SECONDS = 60;

export default function OfflineScreen() {
  return (
    <Stage value>
      <Offline />
    </Stage>
  );
}

function Offline() {
  const { job } = useLocalSearchParams<{ job: string }>();
  const copy = useCopy(job ?? '');
  if (copy?.state !== 'saved') {
    return (
      <View style={[styles.screen, styles.gone]}>
        <Text style={type.title}>This film is no longer on the phone</Text>
        <Button label="Close" kind="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  return <SavedPlayer copy={copy} />;
}

function SavedPlayer({ copy }: { copy: Extract<Copy, { state: 'saved' }> }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer({ uri: copy.uri, metadata: { title: copy.label.title } }, (p) => {
    p.keepScreenOnWhilePlaying = true;
    p.play();
  });

  const [preferences] = usePlayerPreferences();
  const [cues, setCues] = useState<Cue[]>([]);
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;
  }, [player]);

  useEffect(() => {
    if (!copy.subtitles) return;
    try {
      const parser = new VttParser();
      const text = new File(copy.subtitles).textSync();
      setCues([...parser.feed(text), ...parser.finish()].sort((a, b) => a.start - b.start));
    } catch {}
  }, [copy.subtitles]);

  useEffect(() => {
    const key = `offline-at-${copy.job}`;
    let stopped = false;
    SecureStore.getItemAsync(key)
      .then((saved) => {
        const at = Number(saved);
        if (!stopped && at > 5) player.currentTime = at;
      })
      .catch(() => {});
    const keep = () => {
      const at = player.currentTime;
      const near = player.duration > 0 && player.duration - at < ENDING_SECONDS;
      SecureStore.setItemAsync(key, near ? '0' : String(Math.floor(at))).catch(() => {});
    };
    const timer = setInterval(keep, KEEP_EVERY_MS);
    const subscription = AppState.addEventListener('change', (next) => next !== 'active' && keep());
    return () => {
      stopped = true;
      clearInterval(timer);
      subscription.remove();
      keep();
    };
  }, [copy.job, player]);

  return (
    <View style={styles.screen}>
      <View
        style={[styles.bar, { paddingTop: insets.top, height: 48 + insets.top, paddingLeft: insets.left + space.sm }]}
      >
        <Tap haptic shrink={0.88} onPress={() => router.back()} accessibilityLabel="Close" style={styles.close}>
          <Icon name={icons.close} size={22} tint={color.ink} />
        </Tap>
        <Text style={styles.title} numberOfLines={1}>
          {copy.label.title} <Text style={{ color: color.pencil, fontFamily: font.regular }}>{copy.label.tags}</Text>
        </Text>
      </View>
      <View style={styles.video}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls
          contentFit="contain"
          allowsPictureInPicture
          startsPictureInPictureAutomatically
        />
        {cues.length > 0 ? (
          <SubtitleOverlay cues={cues} time={currentTime} lifted look={preferences.subtitleStyle} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  gone: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.lg },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: color.ink },
  video: { flex: 1 },
});
