import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { color } from '@/theme';

/** A placeholder in the shape of what is loading, breathing slowly so the wait reads as progress. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }));

  return <Animated.View style={[{ backgroundColor: color.raised }, animated, style]} />;
}
