import Animated, { Keyframe } from 'react-native-reanimated';

import { motion } from '@/theme';

import { Icon, icons } from './Icon';
import { useTone } from './stage';
import { vanish } from '@/ui/presets';

const IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  60: { opacity: 1, transform: [{ scale: 1.06 }], easing: motion.out },
  100: { transform: [{ scale: 1 }], easing: motion.out },
}).duration(220);

export function Check({ shown, size = 20 }: { shown: boolean; size?: number }) {
  const tone = useTone();

  if (!shown) return null;

  return (
    <Animated.View entering={IN} exiting={vanish}>
      <Icon name={icons.check} size={size} tint={tone.action} weight={2.6} />
    </Animated.View>
  );
}
