import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Switch } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { alpha, color, motion } from '@/theme';

const TRACK = { width: 51, height: 31 };
const INSET = 2;
const THUMB = TRACK.height - INSET * 2;
const STRETCH = 6;
const TRAVEL = TRACK.width - THUMB - INSET * 2;

/**
 * An on/off switch in the iPhone's shape: the system switch on iOS, and on Android a pill whose white thumb springs
 * across and stretches while pressed, filling with the theme's accent when on.
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  if (Platform.OS === 'ios') {
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: color.action }}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return <DrawnToggle value={value} onValueChange={onValueChange} accessibilityLabel={accessibilityLabel} />;
}

function DrawnToggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const on = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);
  const offTrack = alpha(color.ink, 0.16);
  const onTrack = color.action;

  useEffect(() => {
    on.set(withSpring(value ? 1 : 0, motion.settle));
  }, [value, on]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [offTrack, onTrack]),
  }));

  const thumb = useAnimatedStyle(() => {
    const stretch = pressed.get() * STRETCH;

    return {
      width: THUMB + stretch,
      transform: [{ translateX: interpolate(on.get(), [0, 1], [0, TRAVEL - stretch]) }],
    };
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onValueChange(!value);
      }}
      onPressIn={() => pressed.set(withSpring(1, motion.settle))}
      onPressOut={() => pressed.set(withSpring(0, motion.settle))}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.thumb, thumb]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { ...TRACK, borderRadius: TRACK.height / 2, padding: INSET, justifyContent: 'center' },
  thumb: {
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
