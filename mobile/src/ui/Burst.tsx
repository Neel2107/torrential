import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { color } from '@/theme';

const DOTS = 7;

export type BurstHandle = { fire: () => void };

export const Burst = forwardRef<BurstHandle, { size?: number; tint?: string }>(function Burst(
  { size = 44, tint = color.action },
  ref,
) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    fire: () => {
      if (reduced) return;
      t.set(0);
      t.set(withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
    },
  }));

  const ring = useAnimatedStyle(() => ({
    opacity: t.get() === 0 || t.get() === 1 ? 0 : 1 - t.get(),
    transform: [{ scale: 0.4 + t.get() * 1.1 }],
    borderWidth: Math.max(0.5, 6 * (1 - t.get())),
  }));

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}
    >
      <Animated.View style={[styles.ring, { borderColor: tint, borderRadius: size / 2 }, ring]} />
      {Array.from({ length: DOTS }, (_, i) => (
        <Dot key={i} angle={(i / DOTS) * Math.PI * 2 - Math.PI / 2} t={t} reach={size * 0.85} tint={tint} />
      ))}
    </View>
  );
});

function Dot({
  angle,
  t,
  reach,
  tint,
}: {
  angle: number;
  t: ReturnType<typeof useSharedValue<number>>;
  reach: number;
  tint: string;
}) {
  const style = useAnimatedStyle(() => {
    const travel = Math.min(1, t.get() * 1.4);

    return {
      opacity: t.get() === 0 || t.get() === 1 ? 0 : t.get() < 0.35 ? 0 : 1 - (t.get() - 0.35) / 0.65,
      transform: [
        { translateX: Math.cos(angle) * reach * travel },
        { translateY: Math.sin(angle) * reach * travel },
        { scale: 1 - t.get() * 0.6 },
      ],
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: tint }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: '50%', top: '50%', alignItems: 'center', justifyContent: 'center' },
  ring: { ...StyleSheet.absoluteFill },
  dot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
});
