import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { font, motion, radius, space } from '@/theme';

import { useTone } from './stage';
import { Tap } from './Tap';

/** One choice of a few, shown side by side. The chosen one fills with ink; choosing it again does nothing and stays quiet. */
export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel = label,
  radio = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  radio?: boolean;
}) {
  const tone = useTone();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: motion.quick, easing: motion.out }));
  }, [selected, on]);

  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [tone.lifted, tone.ink]),
  }));

  const text = useAnimatedStyle(() => ({ color: interpolateColor(on.get(), [0, 1], [tone.soft, tone.paper]) }));

  return (
    <Tap
      shrink={0.96}
      haptic={!selected}
      onPress={onPress}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.chip, fill]}>
        <Animated.Text style={[styles.label, text]}>{label}</Animated.Text>
      </Animated.View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 52,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: font.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
});
