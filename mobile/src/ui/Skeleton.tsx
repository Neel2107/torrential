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

import { useTone } from './stage';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const tone = useTone();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    pulse.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.get() * 0.45 }));

  return <Animated.View style={[{ backgroundColor: tone.raised }, animated, style]} />;
}
