import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { color, motion } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring drawn over a round button's edge, filling clockwise from the top. */
export function ProgressRing({ size, fraction, stroke = 2.5 }: { size: number; fraction: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const around = 2 * Math.PI * r;
  const filled = useSharedValue(0);

  useEffect(() => {
    filled.set(withTiming(Math.min(1, Math.max(0.02, fraction)), { duration: 600, easing: motion.out }));
  }, [filled, fraction]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: around * (1 - filled.get()) }));

  return (
    <Svg width={size} height={size} style={[StyleSheet.absoluteFill, styles.turned]} pointerEvents="none">
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} stroke={color.rule} strokeWidth={1} fill="none" />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color.action}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${around} ${around}`}
        fill="none"
        animatedProps={arc}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({ turned: { transform: [{ rotate: '-90deg' }] } });
