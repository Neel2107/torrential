import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { clock } from '@web/lib/format';
import { THUMBNAIL_EVERY } from '@web/wire';

import { authHeaders, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { stage as color, font, motion, radius } from '@/theme';

import { runsOf, type Downloaded } from './downloaded';

const THUMB_WIDTH = 160;

export function SeekBar({
  position,
  duration,
  buffered,
  download,
  downloaded,
  onScrubbing,
  onSeek,
}: {
  position: number;
  duration: number;
  buffered: number;
  download: { id: string; file: number };
  downloaded: Downloaded;
  onScrubbing: (scrubbing: boolean) => void;
  onSeek: (seconds: number) => void;
}) {
  const link = useLink();
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const touching = useSharedValue(0);
  const x = useSharedValue(0);

  const runs = useMemo(() => runsOf(downloaded), [downloaded]);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  const shown = preview ?? position;

  const pick = (px: number, final: boolean) => {
    if (duration <= 0) return onScrubbing(false);
    const seconds = Math.max(0, Math.min(duration, (px / Math.max(1, width)) * duration));
    if (final) {
      setPreview(null);
      onScrubbing(false);
      onSeek(seconds);
    } else {
      setPreview(seconds);
    }
  };

  const begin = () => {
    onScrubbing(true);
    Haptics.selectionAsync();
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .hitSlop({ top: 20, bottom: 20 })
    .onBegin((event) => {
      touching.value = withTiming(1, { duration: motion.press });
      x.value = event.x;
      runOnJS(begin)();
      runOnJS(pick)(event.x, false);
    })
    .onUpdate((event) => {
      x.value = Math.max(0, Math.min(width, event.x));
      runOnJS(pick)(x.value, false);
    })
    .onFinalize((event) => {
      touching.value = withSpring(0, motion.settle);
      runOnJS(pick)(Math.max(0, Math.min(width, event.x)), true);
    });

  const track = useAnimatedStyle(() => ({ height: 3 + touching.value * 4, borderRadius: 4 }));
  const knob = useAnimatedStyle(() => ({ transform: [{ scale: 0.75 + touching.value * 0.55 }] }));

  const previewFraction = duration > 0 ? shown / duration : 0;
  const thumbLeft = Math.max(0, Math.min(width - THUMB_WIDTH, previewFraction * width - THUMB_WIDTH / 2));
  const wanted = Math.floor(shown / THUMBNAIL_EVERY) * THUMBNAIL_EVERY;
  const [thumbTime, setThumbTime] = useState(wanted);
  const [lastFrame, setLastFrame] = useState<string | null>(null);

  useEffect(() => {
    if (preview === null) return;
    const timer = setTimeout(() => setThumbTime(wanted), 120);
    return () => clearTimeout(timer);
  }, [wanted, preview]);

  const frame = url(link, '/api/thumbnail', { id: download.id, file: download.file, t: thumbTime });

  return (
    <View style={styles.wrap}>
      {preview !== null && width > 0 ? (
        <Animated.View style={[styles.bubble, { left: thumbLeft }]} pointerEvents="none">
          <Image
            source={{ uri: frame, headers: authHeaders(link) }}
            placeholder={lastFrame ? { uri: lastFrame, headers: authHeaders(link) } : undefined}
            placeholderContentFit="cover"
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            onLoad={() => setLastFrame(frame)}
          />
          <Text style={styles.bubbleTime}>{clock(shown)}</Text>
        </Animated.View>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.time}>{clock(shown)}</Text>
        <GestureDetector gesture={pan}>
          <View
            style={styles.hit}
            onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
            accessibilityRole="adjustable"
            accessibilityLabel="Position"
            accessibilityValue={{ text: `${clock(position)} of ${clock(duration)}` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) =>
              onSeek(position + (event.nativeEvent.actionName === 'increment' ? 10 : -10))
            }
          >
            <Animated.View style={[styles.track, track]}>
              {runs.map((run) => (
                <View
                  key={run.from}
                  style={[
                    styles.downloaded,
                    {
                      left: `${run.from * 100}%`,
                      width: `${(run.to - run.from) * 100}%`,
                      backgroundColor: `rgba(240, 233, 220, ${(0.06 + run.share * 0.14).toFixed(3)})`,
                    },
                  ]}
                />
              ))}
              <View
                style={[styles.buffered, { width: `${duration > 0 ? Math.min(1, buffered / duration) * 100 : 0}%` }]}
              />
              <View style={[styles.played, { width: `${(preview !== null ? previewFraction : fraction) * 100}%` }]} />
            </Animated.View>
            <Animated.View
              style={[styles.knob, { left: (preview !== null ? previewFraction : fraction) * width - 8 }, knob]}
            />
          </View>
        </GestureDetector>
        <Text style={styles.time}>-{clock(Math.max(0, duration - shown))}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hit: { flex: 1, height: 36, justifyContent: 'center' },
  track: { width: '100%', backgroundColor: 'rgba(240, 233, 220, 0.14)', overflow: 'hidden' },
  downloaded: { position: 'absolute', top: 0, bottom: 0 },
  buffered: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: 'rgba(240, 233, 220, 0.32)' },
  played: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: color.action },
  knob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: color.ink,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  time: {
    fontFamily: font.medium,
    fontSize: 13,
    color: color.ink,
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'center',
  },
  bubble: { position: 'absolute', bottom: 48, width: THUMB_WIDTH, alignItems: 'center', gap: 6 },
  thumb: {
    width: THUMB_WIDTH,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: color.raised,
    borderWidth: 2,
    borderColor: color.ink,
  },
  bubbleTime: { fontFamily: font.semibold, fontSize: 14, color: color.ink, fontVariant: ['tabular-nums'] },
});
