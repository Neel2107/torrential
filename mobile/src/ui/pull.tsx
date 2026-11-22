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
const CYCLE = 1200;

/** How lit band `index` is at `phase` of a pass: each band peaks in turn, top to bottom. */
const band = (phase: number, index: number): number => {
  'worklet';
  // Each band takes its turn in a third of the pass: it lights fully, then falls back to almost
  // nothing, so the eye follows one bright band down the mark.
  const t = (((phase - index / 3) % 1) + 1) % 1;
  const peak = t < 0.15 ? t / 0.15 : t < 0.33 ? 1 : t < 0.48 ? 1 - (t - 0.33) / 0.15 : 0;
  return 0.12 + 0.88 * peak;
};

/** How lit band `index` is at `progress` of the way to the line: each fills in its own third. */
const fill = (progress: number, index: number): number => {
  'worklet';
  return 0.15 + 0.85 * Math.min(1, Math.max(0, progress * 3 - index));
};

type Pull = {
  /** Points pulled, after resistance. */
  pull: SharedValue<number>;
  /** How far into a breath the mark is while the feed refreshes, 0 to 1. */
  spin: SharedValue<number>;
  /** 1 while refreshing, easing to 0 after, so the bands return to rest smoothly. */
  busy: SharedValue<number>;
  /** 1 while a finger is pulling: the bands fill with the pull then, as X's logo fills in. */
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
  const { pull, spin, busy: lit, holding } = usePull();
  const bounced = useSharedValue(false);
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
    // Whole passes only, at least one: the light reaches the last band before the mark settles,
    // however quickly the feed came back. The last band's light ends a little after its pass.
    const passes = Math.max(1, Math.ceil((Date.now() - started) / CYCLE));
    const end = started + passes * CYCLE + CYCLE * 0.15;
    await new Promise((done) => setTimeout(done, Math.max(0, end - Date.now())));
    lit.value = withTiming(0, { duration: 300 }, () => cancelAnimation(spin));
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
    holding.value = 0;
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
        holding.value = 1;
      })
      .onUpdate((event) => {
        'worklet';
        pull.value = offset.value <= 0 && event.translationY > 0 ? resist(event.translationY) : 0;
      })
      .onEnd(release)
      .onFinalize(() => {
        'worklet';
        holding.value = 0;
        if (pull.value > 0 && pull.value < LINE) pull.value = withSpring(0, motion.settle);
      });
    return Gesture.Simultaneous(Gesture.Native(), pan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, pull, refresh, holding]);

  /** For the scroll handler on iOS: the bounce past the top is the pull. */
  const fromBounce = (y: number) => {
    'worklet';
    if (Platform.OS !== 'ios') return;
    pull.value = Math.min(MOST, Math.max(0, -y));
    // The bounce back after letting go is not a finger pulling.
    if (y >= 0) bounced.value = false;
    else if (!bounced.value) holding.value = 1;
  };
  const endBounce = () => {
    'worklet';
    if (Platform.OS !== 'ios') return;
    bounced.value = true;
    release();
  };

  const feed = useAnimatedStyle(() => (Platform.OS === 'android' ? { transform: [{ translateY: pull.value }] } : {}));

  return { gesture, fromBounce, endBounce, feed };
}

/** The header's growth with the pull, for the bar's row. */
export function usePullHeight() {
  const { pull } = usePull();
  return pull;
}

/**
 * The mark in the bar. It grows with the pull, dim until the pull would refresh, as X's does; while
 * the feed refreshes its three bands light top to bottom, like pieces of a torrent landing.
 */
export function PullMark({ size = 30 }: { size?: number }) {
  const { pull, spin, busy, holding } = usePull();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (pull.value / MOST) * 0.6 }] }));
  // At rest all three bands are alike, so the fill and the pass read clearly against them; the app
  // icon keeps its faint last band. Each band is its own layer: animated SVG props do not reach the drawing on Android.
  // The maths sits inside each style: a helper closure here is rewritten by the React Compiler and
  // never reaches the UI thread.
  // While pulling, as X's logo fills in stroke by stroke, the bands fill in turn: all three are lit
  // exactly at the line, so the mark shows when letting go will refresh.
  const top = useAnimatedStyle(() => ({
    opacity: holding.value && pull.value > 0 ? fill(pull.value / LINE, 0) : 1 + (band(spin.value, 0) - 1) * busy.value,
  }));
  const middle = useAnimatedStyle(() => ({
    opacity: holding.value && pull.value > 0 ? fill(pull.value / LINE, 1) : 1 + (band(spin.value, 1) - 1) * busy.value,
  }));
  const last = useAnimatedStyle(() => ({
    opacity:
      holding.value && pull.value > 0 ? fill(pull.value / LINE, 2) : 1 + (band(spin.value, 2) - 1) * busy.value,
  }));
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
