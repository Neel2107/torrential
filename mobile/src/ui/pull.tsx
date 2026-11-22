import * as Haptics from 'expo-haptics';
import { createContext, use, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motion } from '@/theme';

import { Mark } from './Mark';

/**
 * Pull to refresh as X has it: the header stretches with the finger and the mark grows in it; let
 * go past the line and the header snaps back while the mark flips until the feed is fresh. No
 * spinner and no gap above the feed.
 *
 * Android lists cannot be pulled past their top, so a pan beside the list's own scrolling does the
 * pulling there. iOS lists bounce, and the bounce is the pull.
 */

/** How far a pull goes, at most, after resistance. */
const MOST = 130;
/** Past this a release refreshes. */
const LINE = 70;
/** One flip of the mark. */
const TURN = 520;
/** A refresh flips at least this long, so a quick answer still reads as a refresh. */
const AT_LEAST = 700;

type Pull = {
  /** Points pulled, after resistance. */
  pull: SharedValue<number>;
  /** Degrees the mark has turned. */
  spin: SharedValue<number>;
};

const Context = createContext<Pull | null>(null);

export function PullProvider({ children }: { children: ReactNode }) {
  const pull = useSharedValue(0);
  const spin = useSharedValue(0);
  const value = useMemo(() => ({ pull, spin }), [pull, spin]);
  return <Context value={value}>{children}</Context>;
}

function usePull(): Pull {
  const value = use(Context);
  if (!value) throw new Error('pull outside PullProvider');
  return value;
}

/** Resistance: the further the finger goes, the less the header follows. */
function resist(distance: number): number {
  'worklet';
  return MOST * (1 - Math.exp(-Math.max(0, distance) / (MOST * 1.6)));
}

/**
 * Pull to refresh for one feed. `offset` is the feed's scroll position, which its scroll handler
 * keeps. Gives the gesture to wrap the list in (Android), what to do with the scroll's negative
 * offset (iOS), and the feed's style, which moves it down with the pull on Android.
 */
export function usePullToRefresh(offset: SharedValue<number>, onRefresh: () => Promise<unknown>) {
  const { pull, spin } = usePull();
  const busy = useRef(false);
  const crossed = useSharedValue(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: TURN, easing: Easing.inOut(Easing.cubic) }), -1);
    const started = Date.now();
    await onRefresh().catch(() => {});
    await new Promise((done) => setTimeout(done, Math.max(0, AT_LEAST - (Date.now() - started))));
    // The flip under way ends where it began, so the mark never stops on its side.
    const now = spin.value % 360;
    cancelAnimation(spin);
    spin.value = now;
    spin.value = withTiming(360, { duration: TURN * ((360 - now) / 360), easing: Easing.out(Easing.cubic) }, () => {
      spin.value = 0;
    });
    busy.current = false;
  }, [onRefresh, spin]);

  const tick = useCallback(() => Haptics.selectionAsync(), []);

  // One light tap as the pull crosses the line, the way X answers the finger.
  useAnimatedReaction(
    () => pull.value >= LINE,
    (over, was) => {
      if (over && !was && !crossed.value) {
        crossed.value = true;
        runOnJS(tick)();
      }
      if (!over) crossed.value = false;
    },
  );

  const release = () => {
    'worklet';
    const go = pull.value >= LINE;
    pull.value = withSpring(0, { ...motion.settle, overshootClamping: true });
    if (go) runOnJS(refresh)();
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(Platform.OS === 'android')
      .activeOffsetY([-8, 8])
      .onStart(() => {
        'worklet';
      })
      .onUpdate((event) => {
        'worklet';
        pull.value = offset.value <= 0 && event.translationY > 0 ? resist(event.translationY) : 0;
      })
      .onEnd(release)
      .onFinalize(() => {
        'worklet';
        if (pull.value > 0 && pull.value < LINE) pull.value = withSpring(0, motion.settle);
      });
    return Gesture.Simultaneous(Gesture.Native(), pan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, pull, refresh]);

  /** For the scroll handler on iOS: the bounce past the top is the pull. */
  const fromBounce = (y: number) => {
    'worklet';
    if (Platform.OS === 'ios') pull.value = Math.min(MOST, Math.max(0, -y));
  };
  const endBounce = () => {
    'worklet';
    if (Platform.OS === 'ios') release();
  };

  const feed = useAnimatedStyle(() => (Platform.OS === 'android' ? { transform: [{ translateY: pull.value }] } : {}));

  return { gesture, fromBounce, endBounce, feed };
}

/** The header's growth with the pull, for the bar's row. */
export function usePullHeight() {
  const { pull } = usePull();
  return pull;
}

/** The mark in the bar: it grows with the pull and flips while the feed refreshes. */
export function PullMark({ size = 30 }: { size?: number }) {
  const { pull, spin } = usePull();
  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { scale: 1 + (pull.value / MOST) * 0.6 }, { rotateY: `${spin.value}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Mark size={size} />
    </Animated.View>
  );
}
