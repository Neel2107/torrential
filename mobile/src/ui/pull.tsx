import * as Haptics from 'expo-haptics';
import { createContext, use, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/theme';

import { BandsMark, fill } from './Bands';

// Android lists cannot be pulled past their top, so a pan beside the scroll does the pulling there.
// iOS lists bounce, and the bounce is the pull.
const MOST = 130;
const LINE = 70;
const FLIP = 650;
type Pull = {
  pull: SharedValue<number>;
  spin: SharedValue<number>;
  busy: SharedValue<number>;
  holding: SharedValue<number>;
};

const Context = createContext<Pull | null>(null);

export function PullProvider({ children }: { children: ReactNode }) {
  const pull = useSharedValue(0);
  const spin = useSharedValue(0);
  const busy = useSharedValue(0);
  const holding = useSharedValue(0);
  const value = useMemo(() => ({ pull, spin, busy, holding }), [pull, spin, busy, holding]);
  return <Context value={value}>{children}</Context>;
}

function usePull(): Pull {
  const value = use(Context);
  if (!value) throw new Error('pull outside PullProvider');
  return value;
}

function resist(distance: number): number {
  'worklet';
  return MOST * (1 - Math.exp(-Math.max(0, distance) / (MOST * 1.6)));
}

export function usePullToRefresh(offset: SharedValue<number>, onRefresh: () => Promise<unknown>) {
  const { pull, spin, busy: lit, holding } = usePull();
  const bounced = useSharedValue(false);
  const busy = useRef(false);
  const crossed = useSharedValue(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    spin.set(0);
    spin.set(withRepeat(withTiming(1, { duration: FLIP, easing: Easing.inOut(Easing.cubic) }), -1, false));
    lit.set(1);
    const started = Date.now();
    await onRefresh().catch(() => {});
    // Whole turns, so the mark lands face on however quickly the feed came back.
    const turns = Math.max(1, Math.ceil((Date.now() - started) / FLIP));
    await new Promise((done) => setTimeout(done, Math.max(0, started + turns * FLIP - Date.now())));
    const left = 1 - spin.get();
    cancelAnimation(spin);
    spin.set(
      withTiming(1, { duration: Math.max(0, left * FLIP), easing: Easing.out(Easing.cubic) }, () => {
        spin.set(0);
        lit.set(0);
      }),
    );
    busy.current = false;
  }, [onRefresh, spin, lit]);

  const tick = useCallback(() => Haptics.selectionAsync(), []);

  useAnimatedReaction(
    () => pull.get() >= LINE,
    (over, was) => {
      if (over && !was && !crossed.get()) {
        crossed.set(true);
        scheduleOnRN(tick);
      }
      if (!over) crossed.set(false);
    },
  );

  const release = () => {
    'worklet';
    holding.set(0);
    const go = pull.get() >= LINE;
    pull.set(withSpring(0, { ...motion.snap, overshootClamping: true }));
    if (go) scheduleOnRN(refresh);
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(Platform.OS === 'android')
      .activeOffsetY([-8, 8])
      .onStart(() => {
        'worklet';
        holding.set(1);
      })
      .onUpdate((event) => {
        'worklet';
        pull.set(offset.get() <= 0 && event.translationY > 0 ? resist(event.translationY) : 0);
      })
      .onEnd(release)
      .onFinalize(() => {
        'worklet';
        holding.set(0);
        if (pull.get() > 0 && pull.get() < LINE) pull.set(withSpring(0, { ...motion.snap, overshootClamping: true }));
      });
    return Gesture.Simultaneous(Gesture.Native(), pan);
  }, [offset, pull, refresh, holding]);

  const fromBounce = (y: number) => {
    'worklet';
    if (Platform.OS !== 'ios') return;
    pull.set(Math.min(MOST, Math.max(0, -y)));
    // The bounce back after letting go is not a finger pulling.
    if (y >= 0) bounced.set(false);
    else if (!bounced.get()) holding.set(1);
  };
  const endBounce = () => {
    'worklet';
    if (Platform.OS !== 'ios') return;
    bounced.set(true);
    release();
  };

  const feed = useAnimatedStyle(() => (Platform.OS === 'android' ? { transform: [{ translateY: pull.get() }] } : {}));

  return { gesture, fromBounce, endBounce, feed };
}

export function usePullHeight() {
  const { pull } = usePull();
  return pull;
}

export function PullMark({ size = 30 }: { size?: number }) {
  const { pull, spin, busy, holding } = usePull();
  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { scale: 1 + (pull.get() / MOST) * 0.6 },
      { rotateY: `${spin.get() * 360 * busy.get()}deg` },
    ],
  }));
  const top = useAnimatedStyle(() => ({
    opacity: holding.get() && pull.get() > 0 ? fill(pull.get() / LINE, 0) : 1,
  }));
  const middle = useAnimatedStyle(() => ({
    opacity: holding.get() && pull.get() > 0 ? fill(pull.get() / LINE, 1) : 1,
  }));
  const last = useAnimatedStyle(() => ({
    opacity: holding.get() && pull.get() > 0 ? fill(pull.get() / LINE, 2) : 1,
  }));
  return <BandsMark size={size} bands={[top, middle, last]} style={style} />;
}
