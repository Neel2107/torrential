import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LucideIcon } from 'lucide-react-native';

import { alpha, color, font, space } from '@/theme';

import { useChrome } from './chrome';
import { TabStrip } from './Pager';
import { usePullHeight } from './pull';
import { Glass, LIQUID_GLASS } from './Glass';
import { Icon } from './Icon';
import { Tap } from './Tap';

export const BAR_HEIGHT = 52;
export const TABS_HEIGHT = 48;

export function useTopInset(withTabs: boolean): number {
  const insets = useSafeAreaInsets();
  return insets.top + BAR_HEIGHT + (withTabs ? TABS_HEIGHT : 0);
}

export function TopBar({
  left,
  title,
  right,
  tabs,
}: {
  left?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  tabs?: { labels: string[]; index: number; position: SharedValue<number>; onChange: (index: number) => void };
}) {
  const insets = useSafeAreaInsets();
  const { hidden } = useChrome();
  const pull = usePullHeight();

  const stretch = useAnimatedStyle(() => ({ transform: [{ translateY: pull.get() / 2 }] }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.get() * BAR_HEIGHT }] }));
  const fade = useAnimatedStyle(() => ({ opacity: interpolate(hidden.get(), [0, 0.6], [1, 0]) }));

  return (
    <>
      <Animated.View style={[styles.wrap, { paddingTop: insets.top }, slide]}>
        <Animated.View style={[styles.row, stretch, fade]}>
          <View style={styles.side}>{left}</View>
          <View style={styles.middle}>
            {typeof title === 'string' ? (
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
                {title}
              </Text>
            ) : (
              title
            )}
          </View>
          <View style={[styles.side, styles.end]}>{right}</View>
        </Animated.View>
        {tabs ? <TabStrip {...tabs} /> : <View style={styles.rule} />}
      </Animated.View>
      <View style={[styles.statusShade, { height: insets.top }]} pointerEvents="none" />
    </>
  );
}

export type Action = { icon: LucideIcon; label: string; onPress: () => void };

export function Actions({ actions }: { actions: Action[] }) {
  return (
    <Glass interactive style={styles.actions} fallback="transparent">
      {actions.map((action) => (
        <Tap
          key={action.label}
          haptic
          shrink={0.9}
          onPress={action.onPress}
          accessibilityLabel={action.label}
          style={styles.action}
        >
          <Icon name={action.icon} size={LIQUID_GLASS ? 20 : 22} tint={color.ink} />
        </Tap>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: alpha(color.paper, 0.96),
  },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11, backgroundColor: color.paper },
  row: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg },
  side: { minWidth: 64, flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', borderRadius: 20, paddingHorizontal: LIQUID_GLASS ? 2 : 0 },
  action: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  end: { justifyContent: 'flex-end' },
  middle: { flex: 1, alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 19, letterSpacing: -0.4, color: color.ink },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.rule },
});
