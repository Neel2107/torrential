import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { color, hitSlop } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Every tappable thing: it sinks a little under the finger, ripples on Android, and can tick the
 * haptic engine. `shrink` is how far it sinks, smaller for big cards so they feel heavy.
 */
export function Tap({
  children,
  style,
  shrink = 0.96,
  haptic = false,
  ripple = true,
  onPress,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  shrink?: number;
  haptic?: boolean;
  ripple?: boolean;
}) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - shrink) * pressed.value }],
  }));

  return (
    <AnimatedPressable
      hitSlop={hitSlop}
      accessibilityRole="button"
      android_ripple={ripple ? { color: color.hairline, foreground: true, borderless: false } : undefined}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 15, stiffness: 300 });
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
