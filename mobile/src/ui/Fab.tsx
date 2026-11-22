import type { LucideIcon } from 'lucide-react-native';
import { Platform, StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { color, space } from '@/theme';

import { useChrome } from './chrome';
import { Icon } from './Icon';
import { TAB_BAR_HEIGHT } from './TabBar';
import { Tap } from './Tap';
import { reflow } from '@/ui/presets';

/** The system tab bar on iOS keeps Search in the corner the floating button takes, so there it sits in the top bar. */
export const ADD_IN_TOP_BAR = Platform.OS === 'ios';

export const FAB_ROOM = ADD_IN_TOP_BAR ? space.xl : 96;

export function Fab({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { hidden, bottom } = useChrome();

  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(hidden.get(), [0, 1], [1, 0.45]),
    transform: [{ translateY: hidden.get() * (TAB_BAR_HEIGHT * 0.6) }],
  }));

  if (ADD_IN_TOP_BAR) return null;

  return (
    <Animated.View layout={reflow} style={[styles.wrap, { bottom: bottom + space.lg }, fade]}>
      <Tap haptic shrink={0.92} onPress={onPress} accessibilityLabel={label} style={styles.fab}>
        <Icon name={icon} size={26} tint={color.actionInk} weight={2.4} />
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: space.lg },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.action,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
