import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, space } from '@/theme';

import { useChrome } from './chrome';
import { Icon } from './Icon';
import { TAB_BAR_HEIGHT } from './TabBar';
import { Tap } from './Tap';

/** The floating button in the corner. It turns see-through while the feed scrolls, as X's does. */
export function Fab({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { hidden } = useChrome();
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(hidden.value, [0, 1], [1, 0.45]),
    transform: [{ translateY: hidden.value * (TAB_BAR_HEIGHT * 0.6) }],
  }));

  return (
    <Animated.View style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + space.lg }, fade]}>
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
