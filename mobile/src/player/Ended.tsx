import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { icons } from '@/ui/Icon';
import { stage as color, font, motion, radius, space, stageType as type } from '@/theme';

import { useSources } from './sources';

export type UpNext = { video: string; name: string; title: string; season: number; episode: number; still: boolean };

const UP_NEXT_SECONDS = 10;

export function Ended({
  next,
  onNext,
  onReplay,
  onBack,
}: {
  next: UpNext | null;
  onNext: () => void;
  onReplay: () => void;
  onBack: () => void;
}) {
  const reduced = useReducedMotion();
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
    if (next && !reduced) progress.value = withTiming(1, { duration: UP_NEXT_SECONDS * 1000, easing: Easing.linear });
  }, [next, progress, reduced]);

  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.screen}>
      {next ? (
        <View style={styles.heading}>
          <Text style={[type.label, styles.center]} accessibilityLiveRegion="polite">
            {left === null ? 'Up next' : `Up next in ${left}`}
          </Text>
          <Animated.View entering={FadeIn.duration(motion.standard).delay(120)} style={styles.still}>
            <Art
              id={next.title}
              kind={next.still ? 'thumbnail' : 'background'}
              season={next.still ? next.season : undefined}
              episode={next.still ? next.episode : undefined}
              style={StyleSheet.absoluteFill}
            />
            {left !== null ? (
              <View style={styles.track}>
                <Animated.View style={[styles.fill, bar]} />
              </View>
            ) : null}
          </Animated.View>
          <Text style={[styles.next, styles.center]} numberOfLines={2}>
            {next.name}
          </Text>
        </View>
      ) : (
        <Text style={[type.title, styles.center]}>The end</Text>
      )}
      <View style={styles.actions}>
        {next ? <Button label="Play now" icon={icons.play} onPress={onNext} /> : null}
        {left !== null ? (
          <Button
            label="Cancel"
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
    gap: space.xl,
    padding: space.xl,
  },
  heading: { gap: space.sm, maxWidth: 520, alignItems: 'center' },
  still: { width: 288, height: 162, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.raised },
  center: { textAlign: 'center' },
  next: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: color.ink },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.45)' },
  fill: { height: 4, width: '100%', backgroundColor: color.action, transformOrigin: 'left' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
