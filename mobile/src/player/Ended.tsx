import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { icons } from '@/ui/Icon';
import { Meter } from '@/ui/Meter';
import { stage as color, font, radius, space, stageType as type } from '@/theme';

import { useSources } from './sources';
import { appear, appearAfter } from '@/ui/presets';

export type UpNext = { video: string; name: string; title: string; season: number; episode: number; still: boolean };

const UP_NEXT_SECONDS = 10;
const STILL = { width: 288, height: 162 };
const SMALL_STILL = { width: 192, height: 108 };
const ROOM_FOR_FULL_STILL = 380;
const ROOM_FOR_SMALL_STILL = 260;

export function Ended({
  next,
  slept = false,
  onNext,
  onReplay,
  onBack,
}: {
  next: UpNext | null;
  /** The sleep timer stopped here, before the next episode. */
  slept?: boolean;
  onNext: () => void;
  onReplay: () => void;
  onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();
  const short = viewport.height < ROOM_FOR_FULL_STILL * viewport.fontScale;
  const showStill = viewport.height >= ROOM_FOR_SMALL_STILL * viewport.fontScale;
  const still = short ? SMALL_STILL : STILL;
  const [left, setLeft] = useState<number | null>(next ? UP_NEXT_SECONDS : null);
  const [cancelled, setCancelled] = useState(false);
  const progress = useSharedValue(0);
  const go = useRef(onNext);
  useSources(next && !cancelled ? next.video : null);
  useEffect(() => {
    go.current = onNext;
  }, [onNext]);

  useEffect(() => {
    if (!next || cancelled) return;
    const deadline = Date.now() + UP_NEXT_SECONDS * 1000;

    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);

      if (remaining === 0) {
        clearInterval(tick);
        go.current();
      }
    }, 250);

    return () => clearInterval(tick);
  }, [next, cancelled]);

  useEffect(() => {
    if (next && !reduced) progress.set(withTiming(1, { duration: UP_NEXT_SECONDS * 1000, easing: Easing.linear }));
  }, [next, progress, reduced]);

  useEffect(() => {
    if (next) AccessibilityInfo.announceForAccessibility(`Up next in ${UP_NEXT_SECONDS} seconds: ${next.name}`);
  }, [next]);

  return (
    <Animated.View
      entering={appear}
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, space.lg),
          paddingBottom: Math.max(insets.bottom, space.lg),
          paddingLeft: insets.left + space.xl,
          paddingRight: insets.right + space.xl,
          gap: short ? space.md : space.xl,
        },
      ]}
    >
      <ScrollView style={styles.words} contentContainerStyle={styles.wordsContent} bounces={false}>
        {next ? (
          <View style={styles.heading}>
            <Text style={[type.label, styles.center]}>{left === null ? 'Up next' : `Up next in ${left}`}</Text>
            {showStill ? (
              <Animated.View entering={appearAfter(120)} style={[styles.still, still]}>
                <Art
                  id={next.title}
                  kind={next.still ? 'thumbnail' : 'background'}
                  season={next.still ? next.season : undefined}
                  episode={next.still ? next.episode : undefined}
                  style={StyleSheet.absoluteFill}
                />
                {left !== null ? (
                  <Meter
                    follow={progress}
                    rounded={false}
                    tint={color.action}
                    track="rgba(0,0,0,0.45)"
                    valueText={`${left} seconds left`}
                    style={styles.track}
                  />
                ) : null}
              </Animated.View>
            ) : left !== null ? (
              <Meter
                follow={progress}
                tint={color.action}
                track={color.lifted}
                valueText={`${left} seconds left`}
                style={styles.bareTrack}
              />
            ) : null}
            <Text style={[styles.next, styles.center]} numberOfLines={short ? 1 : 2}>
              {next.name}
            </Text>
          </View>
        ) : (
          <Text style={[type.title, styles.center]}>{slept ? 'Sleep timer ended' : 'The end'}</Text>
        )}
      </ScrollView>
      <View style={styles.actions}>
        {next ? <Button label="Play now" icon={icons.play} onPress={onNext} /> : null}
        {left !== null ? (
          <Button
            label="Stop autoplay"
            kind="secondary"
            onPress={() => {
              setCancelled(true);
              setLeft(null);
              cancelAnimation(progress);
            }}
          />
        ) : (
          <Button label="Watch again" kind={next ? 'secondary' : 'primary'} icon={icons.rewind} onPress={onReplay} />
        )}
        {left === null ? <Button label="Back" kind="quiet" onPress={onBack} /> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flexGrow: 0, flexShrink: 1, alignSelf: 'stretch' },
  wordsContent: { alignItems: 'center' },
  heading: { gap: space.sm, maxWidth: 520, alignItems: 'center' },
  still: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.raised },
  center: { textAlign: 'center' },
  next: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: color.ink },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bareTrack: { width: SMALL_STILL.width },
  actions: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
