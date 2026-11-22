import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { color, hitSlop, motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - shrink) * pressed.value }],
    backgroundColor: highlight ? `rgba(240, 233, 220, ${(0.06 * pressed.value).toFixed(3)})` : undefined,
  }));

  return (
    <AnimatedPressable
      hitSlop={hitSlop}
      accessibilityRole="button"
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: motion.press, easing: motion.out });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, motion.settle);
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
