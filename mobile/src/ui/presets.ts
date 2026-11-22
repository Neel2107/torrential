import { Easing, FadeIn, FadeOut, FadeOutDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { motion } from '@/theme';

/** Something appearing in place. Fades stay under reduced motion: they explain a change without moving anything. */
export const appear = FadeIn.duration(motion.quick).easing(motion.out).reduceMotion(ReduceMotion.Never);

/** The same, after `delay` ms. A preset is shared, so a delay gets its own copy. */
export const appearAfter = (delay: number) =>
  FadeIn.duration(motion.quick).easing(motion.out).delay(delay).reduceMotion(ReduceMotion.Never);

/** Something leaving in place. A fade out runs straight, so it never lingers or vanishes early. */
export const vanish = FadeOut.duration(140).easing(Easing.linear).reduceMotion(ReduceMotion.Never);

/** A bar leaving toward the edge it sits on. */
export const vanishDown = FadeOutDown.duration(motion.quick).easing(motion.out);

/** Neighbours moving into the room something left or made. */
export const reflow = LinearTransition.duration(motion.standard).easing(motion.inOut);
