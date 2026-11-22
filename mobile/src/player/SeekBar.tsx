import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { clock } from '@web/lib/format';
import { THUMBNAIL_EVERY, type Chapter } from '@web/wire';

import { authHeaders, url } from '@/engine/client';
import { useLink } from '@/engine/session';
import { alpha, stage as color, font, motion, radius } from '@/theme';

import { arrivals, runsOf, type Downloaded, type Run } from './downloaded';

const THUMB_WIDTH = 160;
const GLOW = { duration: 1400, easing: Easing.out(Easing.cubic) };

export function SeekBar({
  position,
  duration,
  buffered,
  download,
  downloaded,
  chapters = [],
  onScrubbing,
  onSeek,
}: {
  position: number;
  duration: number;
  buffered: number;
  download: { id: string; file: number };
  downloaded: Downloaded;
  chapters?: Chapter[];
  onScrubbing: (scrubbing: boolean) => void;
  onSeek: (seconds: number) => void;
}) {
  const link = useLink();
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const touching = useSharedValue(0);
  const x = useSharedValue(0);

  const runs = useMemo(() => runsOf(downloaded), [downloaded]);
  const reduced = useReducedMotion();
  const before = useRef<Downloaded | null>(null);
  const [fresh, setFresh] = useState<{ wave: number; runs: Run[] }>({ wave: 0, runs: [] });

  useEffect(() => {
    const previous = before.current;
    before.current = downloaded;

    if (!previous || reduced) return;
    const landed = arrivals(previous, downloaded);

    if (landed.length > 0) setFresh((last) => ({ wave: last.wave + 1, runs: landed }));
  }, [downloaded, reduced]);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  const shown = preview ?? position;

  const marks = duration > 0 ? chapters.filter((chapter) => chapter.start > 1 && chapter.start < duration - 1) : [];

  const chapterAt = (seconds: number) => {
    let found: Chapter | null = null;

    for (const chapter of chapters) if (chapter.start <= seconds) found = chapter;

    return found;
  };

  const lastChapter = useRef<Chapter | null>(null);

  const pick = (px: number, final: boolean) => {
    if (duration <= 0) return onScrubbing(false);
    const seconds = Math.max(0, Math.min(duration, (px / Math.max(1, width)) * duration));

    if (final) {
      setPreview(null);
      onScrubbing(false);
      onSeek(seconds);
    } else {
      setPreview(seconds);
      const chapter = chapterAt(seconds);

      if (chapter !== lastChapter.current) {
        if (lastChapter.current !== null && chapter !== null) Haptics.selectionAsync();
        lastChapter.current = chapter;
      }
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
      touching.set(withTiming(1, { duration: motion.press }));
      x.set(event.x);
      scheduleOnRN(begin);
      scheduleOnRN(pick, event.x, false);
    })
    .onUpdate((event) => {
      x.set(Math.max(0, Math.min(width, event.x)));
      scheduleOnRN(pick, x.get(), false);
    })
    .onFinalize((event) => {
      touching.set(withSpring(0, motion.settle));
      scheduleOnRN(pick, Math.max(0, Math.min(width, event.x)), true);
    });

  const track = useAnimatedStyle(() => ({ height: 3 + touching.get() * 4, borderRadius: 4 }));
  const knob = useAnimatedStyle(() => ({ transform: [{ scale: 0.75 + touching.get() * 0.55 }] }));

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
          {chapterAt(shown)?.title ? (
            <Text style={styles.bubbleChapter} numberOfLines={1}>
              {chapterAt(shown)?.title}
            </Text>
          ) : null}
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
            accessibilityValue={{
              text: [`${clock(position)} of ${clock(duration)}`, chapterAt(position)?.title].filter(Boolean).join(', '),
            }}
            accessibilityActions={[
              { name: 'increment' },
              { name: 'decrement' },
              ...(marks.length > 0
                ? [
                    { name: 'next', label: 'Next chapter' },
                    { name: 'previous', label: 'Previous chapter' },
                  ]
                : []),
            ]}
            onAccessibilityAction={(event) => {
              const action = event.nativeEvent.actionName;

              if (action === 'next') {
                const after = chapters.find((chapter) => chapter.start > position + 1);

                if (after) onSeek(after.start);

                return;
              }

              if (action === 'previous') {
                const here = chapterAt(position);
                const before = here && position - here.start < 3 ? chapterAt(here.start - 1) : here;
                onSeek(before?.start ?? 0);

                return;
              }

              onSeek(position + (action === 'increment' ? 10 : -10));
            }}
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
                      backgroundColor: alpha(color.ink, 0.06 + run.share * 0.14),
                    },
                  ]}
                />
              ))}
              {fresh.runs.map((run) => (
                <Glow key={`${fresh.wave}:${run.from}`} run={run} />
              ))}
              <View
                style={[styles.buffered, { width: `${duration > 0 ? Math.min(1, buffered / duration) * 100 : 0}%` }]}
              />
              <View style={[styles.played, { width: `${(preview !== null ? previewFraction : fraction) * 100}%` }]} />
              {marks.map((chapter) => (
                <View
                  key={chapter.start}
                  style={[styles.chapterGap, { left: `${(chapter.start / duration) * 100}%` }]}
                />
              ))}
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

function Glow({ run }: { run: Run }) {
  const shine = useSharedValue(0.9);
  useEffect(() => {
    shine.set(withTiming(0, GLOW));
  }, [shine]);
  const style = useAnimatedStyle(() => ({ opacity: shine.get() }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glow, { left: `${run.from * 100}%`, width: `${(run.to - run.from) * 100}%` }, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  chapterGap: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hit: { flex: 1, height: 36, justifyContent: 'center' },
  track: { width: '100%', backgroundColor: alpha(color.ink, 0.14), overflow: 'hidden' },
  downloaded: { position: 'absolute', top: 0, bottom: 0 },
  glow: { position: 'absolute', top: 0, bottom: 0, backgroundColor: color.action },
  buffered: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: alpha(color.ink, 0.32) },
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
  bubbleChapter: { fontFamily: font.medium, fontSize: 12, color: color.soft, maxWidth: THUMB_WIDTH - 12 },
});
