import { Keyframe } from 'react-native-reanimated';

import { motion } from '@/theme';

const DELAYS = [0, 30, 55, 75, 90, 100, 110, 120];

const RISES = DELAYS.map((delay) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: motion.out },
  })
    .duration(motion.quick)
    .delay(delay),
);

/** An entrance that rises into place, later for later items, the whole group done in about 300ms. A Keyframe keeps the first delay it is built with, so each step is its own. */
export function rise(index: number) {
  return RISES[Math.min(index, RISES.length - 1)];
}
