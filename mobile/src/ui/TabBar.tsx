import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { color, motion } from '@/theme';

import { useChrome } from './chrome';
import { Icon, icons } from './Icon';

export const TAB_BAR_HEIGHT = 56;

const TABS: Record<string, { icon: LucideIcon; label: string }> = {
  index: { icon: icons.home, label: 'Home' },
  search: { icon: icons.search, label: 'Search' },
  downloads: { icon: icons.downloads, label: 'Downloads' },
};

/**
 * Icons only, filled when selected, on a bar that slides away while the feed scrolls down. Tapping
 * the selected tab again scrolls its feed to the top.
 */
export function TabBar({ state, emitter, navigateToTab, insets, badges }: BottomTabBarProps & { badges: Record<string, boolean> }) {
  const { hidden } = useChrome();
  const height = TAB_BAR_HEIGHT + insets.bottom;

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * height }],
    opacity: interpolate(hidden.value, [0, 1], [1, 0.4]),
  }));

  return (
    <Animated.View style={[styles.bar, { height, paddingBottom: insets.bottom }, slide]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        return (
          <TabButton
            key={route.key}
            icon={tab.icon}
            label={tab.label}
            focused={focused}
            badge={badges[route.name] ?? false}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                Haptics.selectionAsync();
                navigateToTab(route.key);
              }
              hidden.value = withSpring(0, motion.settle);
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </Animated.View>
  );
}

function TabButton({
  icon,
  label,
  focused,
  badge,
  onPress,
  onLongPress,
}: {
  icon: LucideIcon;
  label: string;
  focused: boolean;
  badge: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused && !reduced) {
      scale.value = withSequence(withTiming(0.82, { duration: 90, easing: motion.out }), withSpring(1, motion.pop));
    }
  }, [focused, reduced, scale]);

  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={pop}>
        <Icon name={icon} size={26} filled={focused && icon !== icons.search} weight={focused ? 2.6 : 1.8} tint={focused ? color.ink : color.soft} />
        {badge ? <View style={styles.badge} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 18, 15, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.rule,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_BAR_HEIGHT },
  badge: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: color.action,
    borderWidth: 1.5,
    borderColor: color.paper,
  },
});
