import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { TRIANGLE } from './Mark';
import { useTone } from './stage';

/** Animated SVG props do not reach the drawing on Android, so the layers, not the shapes, carry the opacity. */

export const PASS = 1200;

export const band = (phase: number, index: number): number => {
  'worklet';
  const t = (((phase - index / 3) % 1) + 1) % 1;
  const peak = t < 0.15 ? t / 0.15 : t < 0.33 ? 1 : t < 0.48 ? 1 - (t - 0.33) / 0.15 : 0;

  return 0.12 + 0.88 * peak;
};

export const fill = (progress: number, index: number): number => {
  'worklet';

  return 0.15 + 0.85 * Math.min(1, Math.max(0, progress * 3 - index));
};

const BANDS: [y: number, height: number][] = [
  [300, 118],
  [446, 132],
  [606, 160],
];

type Opacity = AnimatedStyle<ViewStyle>;

export function BandsMark({
  size,
  bands,
  style,
  label = 'torrential',
}: {
  size: number;
  bands: [Opacity, Opacity, Opacity];
  style?: StyleProp<ViewStyle> | Opacity;
  label?: string;
}) {
  const tone = useTone();

  return (
    <Animated.View style={[{ width: size, height: size }, style]} accessibilityLabel={label}>
      {BANDS.map(([y, height], index) => (
        <Animated.View key={y} style={[StyleSheet.absoluteFill, bands[index]]}>
          <Svg width={size} height={size} viewBox="308 300 440 440">
            <Defs>
              <LinearGradient id={`band-${size}-${y}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={tone.markLight} />
                <Stop offset="1" stopColor={tone.markDeep} />
              </LinearGradient>
              <ClipPath id={`band-clip-${size}-${y}`}>
                <Path d={TRIANGLE} transform="translate(-40 42)" />
              </ClipPath>
            </Defs>
            <G clipPath={`url(#band-clip-${size}-${y})`}>
              <Rect x="300" y={y} width="520" height={height} fill={`url(#band-${size}-${y})`} />
            </G>
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

export function LoadingMark({ size, label = 'Loading' }: { size: number; label?: string }) {
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    phase.set(withRepeat(withTiming(1, { duration: PASS, easing: Easing.linear }), -1, false));
  }, [phase, reduced]);
  /** The maths sits inside each style: helper closures in a component are rewritten by the React Compiler and never reach the UI thread. */
  const top = useAnimatedStyle(() => ({ opacity: reduced ? 0.6 : band(phase.get(), 0) }));
  const middle = useAnimatedStyle(() => ({ opacity: reduced ? 0.6 : band(phase.get(), 1) }));
  const last = useAnimatedStyle(() => ({ opacity: reduced ? 0.6 : band(phase.get(), 2) }));

  return <BandsMark size={size} bands={[top, middle, last]} label={label} />;
}
