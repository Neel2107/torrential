import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { alpha, motion, radius } from '@/theme';

import { useTone } from './stage';

function clamp(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/**
 * The one progress bar. `fraction` draws as given, or eases to each new value over a tick when
 * `animated`; `follow` tracks a shared value frame by frame, for bars driven by their own animation.
 */
export function Meter({
  fraction = 0,
  follow,
  animated = false,
  thickness = 4,
  rounded = true,
  tint,
  track,
  valueText,
  style,
}: {
  fraction?: number;
  follow?: SharedValue<number>;
  animated?: boolean;
  thickness?: number;
  rounded?: boolean;
  tint?: string;
  track?: string;
  valueText?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = useTone();
  const fill = { height: thickness, backgroundColor: tint ?? tone.action };
  const now = follow ? undefined : Math.round(clamp(fraction) * 100);

  return (
    <View
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityValue={valueText ? { text: valueText } : { min: 0, max: 100, now }}
      style={[
        styles.track,
        {
          height: thickness,
          borderRadius: rounded ? radius.pill : 0,
          backgroundColor: track ?? alpha(tone.ink, 0.18),
        },
        style,
      ]}
    >
      {follow ? (
        <FollowedFill value={follow} style={fill} />
      ) : animated ? (
        <EasedFill fraction={fraction} style={fill} />
      ) : (
        <View style={[styles.fill, fill, { transform: [{ scaleX: clamp(fraction) }] }]} />
      )}
    </View>
  );
}

type FillStyle = { height: number; backgroundColor: string };

function EasedFill({ fraction, style }: { fraction: number; style: FillStyle }) {
  const value = useDerivedValue(() => withTiming(clamp(fraction), { duration: motion.tick, easing: Easing.linear }));
  const scale = useAnimatedStyle(() => ({ transform: [{ scaleX: value.get() }] }));

  return <Animated.View style={[styles.fill, style, scale]} />;
}

function FollowedFill({ value, style }: { value: SharedValue<number>; style: FillStyle }) {
  const scale = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, value.get())) }] }));

  return <Animated.View style={[styles.fill, style, scale]} />;
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { width: '100%', transformOrigin: 'left' },
});
