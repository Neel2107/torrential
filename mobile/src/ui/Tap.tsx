import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { color, hitSlop, motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Every tappable thing. It sinks under the finger at once and springs back on release, with a soft
 * highlight instead of a ripple. `shrink` is how far it sinks: less for big cards, so they feel heavy.
 */
export function Tap({
  children,
  style,
  shrink = 0.97,
  haptic = false,
  highlight = false,
  onPress,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  shrink?: number;
  haptic?: boolean;
  /** Tints the whole row while pressed, for list rows that should not shrink. */
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
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: motion.press, easing: motion.out });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, motion.settle);
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

