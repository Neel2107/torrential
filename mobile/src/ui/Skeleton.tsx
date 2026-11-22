import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTone } from './stage';

const pulse = makeMutable(0);
let showing = 0;

/** Every skeleton on screen breathes from one pulse, started by the first to appear and stopped with the last. */
function usePulse(reduced: boolean) {
  useEffect(() => {
    if (reduced) return;
    showing += 1;

    if (showing === 1)
      pulse.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));

    return () => {
      showing -= 1;

      if (showing === 0) {
        cancelAnimation(pulse);
        pulse.set(0);
      }
    };
  }, [reduced]);
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const tone = useTone();
  const reduced = useReducedMotion();
  usePulse(reduced);

  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.get() * 0.45 }));

  return <Animated.View style={[{ backgroundColor: tone.raised }, animated, style]} />;
}
