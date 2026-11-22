import { Keyframe } from 'react-native-reanimated';

import { motion } from '@/theme';

const RISE = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 10 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: motion.out },
});

export function rise(index: number) {
  return RISE.duration(260).delay(Math.min(index, 8) * motion.stagger);
}
