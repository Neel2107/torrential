import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { color, motion } from '@/theme';

import { Icon, icons } from './Icon';

const IN = ZoomIn.springify().damping(motion.pop.damping).stiffness(motion.pop.stiffness).mass(motion.pop.mass);

export function Check({ shown, size = 20 }: { shown: boolean; size?: number }) {
  if (!shown) return null;
  return (
    <Animated.View entering={IN} exiting={FadeOut.duration(motion.press)}>
      <Icon name={icons.check} size={size} tint={color.action} weight={2.6} />
    </Animated.View>
  );
}
