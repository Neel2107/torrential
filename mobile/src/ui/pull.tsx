import * as Haptics from 'expo-haptics';
import { createContext, use, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
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

import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { TRIANGLE } from './Mark';

/**
 * Pull to refresh as X has it: the header stretches with the finger and the mark grows in it; let
 * go past the line and the header snaps back while the mark breathes until the feed is fresh. No
 * spinner and no gap above the feed.
 *
 * Android lists cannot be pulled past their top, so a pan beside the list's own scrolling does the
 * pulling there. iOS lists bounce, and the bounce is the pull.
 */

/** How far a pull goes, at most, after resistance. */
const MOST = 130;
/** Past this a release refreshes. */
const LINE = 70;
/** One pass of light down the three bands. */
const CYCLE = 750;
/** A refresh lights at least this long, one full pass and its fade, so a quick answer still reads as one. */
const AT_LEAST = 1000;

type Pull = {
  /** Points pulled, after resistance. */
  pull: SharedValue<number>;
  /** How far into a breath the mark is while the feed refreshes, 0 to 1. */
  spin: SharedValue<number>;
  /** 1 while refreshing, easing to 0 after, so the bands return to rest smoothly. */
  busy: SharedValue<number>;
};

const Context = createContext<Pull | null>(null);

export function PullProvider({ children }: { children: ReactNode }) {
  const pull = useSharedValue(0);
  const spin = useSharedValue(0);
  const busy = useSharedValue(0);
  const value = useMemo(() => ({ pull, spin, busy }), [pull, spin, busy]);
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
  const { pull, spin, busy: lit } = usePull();
  const busy = useRef(false);
  const crossed = useSharedValue(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: CYCLE, easing: Easing.linear }), -1, false);
    lit.value = withTiming(1, { duration: 160 });
    const started = Date.now();
    await onRefresh().catch(() => {});
    await new Promise((done) => setTimeout(done, Math.max(0, AT_LEAST - (Date.now() - started))));
    // The bands finish the cycle under way, then settle back to the mark at rest.
    lit.value = withTiming(0, { duration: 250 }, () => cancelAnimation(spin));
    busy.current = false;
  }, [onRefresh, spin, lit]);

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

/** How lit band `index` is at `phase` of a pass: each band peaks in turn, top to bottom. */
function band(phase: number, index: number): number {
  'worklet';
  const t = (((phase - index * 0.18) % 1) + 1) % 1;
  const peak = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 0.4);
  return 0.3 + 0.7 * peak;
}

/**
 * The mark in the bar. It grows with the pull, dim until the pull would refresh, as X's does; while
 * the feed refreshes its three bands light top to bottom, like pieces of a torrent landing.
 */
export function PullMark({ size = 30 }: { size?: number }) {
  const { pull, spin, busy } = usePull();
  const style = useAnimatedStyle(() => ({
    opacity: pull.value > 0 ? 0.4 + 0.6 * Math.min(1, pull.value / LINE) : 1,
    transform: [{ scale: 1 + (pull.value / MOST) * 0.6 }],
  }));
  // At rest the last band is the faint one still arriving; while refreshing, light runs down all
  // three. Each band is its own layer: animated SVG props do not reach the drawing on Android.
  const lit = (index: number, rest: number) => {
    'worklet';
    return rest + (band(spin.value, index) - rest) * busy.value;
  };
  const top = useAnimatedStyle(() => ({ opacity: lit(0, 1) }));
  const middle = useAnimatedStyle(() => ({ opacity: lit(1, 1) }));
  const last = useAnimatedStyle(() => ({ opacity: lit(2, 0.42) }));
  const layers: [number, number, typeof top][] = [
    [300, 118, top],
    [446, 132, middle],
    [606, 160, last],
  ];
  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessibilityLabel="torrential">
      {layers.map(([y, height, opacity]) => (
        <Animated.View key={y} style={[StyleSheet.absoluteFill, opacity]}>
          <Svg width={size} height={size} viewBox="308 300 440 440">
            <Defs>
              <LinearGradient id={`pull-${y}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#c3dbb8" />
                <Stop offset="1" stopColor="#8fb683" />
              </LinearGradient>
              <ClipPath id={`pull-clip-${y}`}>
                <Path d={TRIANGLE} transform="translate(-40 42)" />
              </ClipPath>
            </Defs>
            <G clipPath={`url(#pull-clip-${y})`}>
              <Rect x="300" y={y} width="520" height={height} fill={`url(#pull-${y})`} />
            </G>
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
}
