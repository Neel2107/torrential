import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { alpha, color, hitSlop, motion, stage } from '@/theme';

import { useStaged } from './stage';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const WASH = [alpha(color.ink, 0), alpha(color.ink, 0.06)];
const STAGE_WASH = [alpha(stage.ink, 0), alpha(stage.ink, 0.06)];

export function Tap({
  children,
  style,
  shrink = 0.97,
  haptic = false,
  highlight = false,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  shrink?: number;
  haptic?: boolean;
  highlight?: boolean;
}) {
  const pressed = useSharedValue(0);
  const wash = useStaged(WASH, STAGE_WASH);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - shrink) * pressed.get() }],
    backgroundColor: highlight ? interpolateColor(pressed.get(), [0, 1], wash) : undefined,
  }));

  return (
    <AnimatedPressable
      hitSlop={highlight ? undefined : hitSlop}
      accessibilityRole="button"
      onPressIn={(event) => {
        pressed.set(withTiming(1, { duration: motion.press, easing: motion.out }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(withTiming(0, { duration: motion.quick, easing: motion.out }));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) Haptics.selectionAsync();
        onPress?.(event);
      }}
      style={[animated, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
