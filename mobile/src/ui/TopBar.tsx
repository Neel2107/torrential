import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, font, motion, space } from '@/theme';

import { useChrome } from './chrome';

export const BAR_HEIGHT = 52;
export const TABS_HEIGHT = 48;

/** The room a feed leaves at its top for the bar, and for its tabs when it has them. */
export function useTopInset(withTabs: boolean): number {
  const insets = useSafeAreaInsets();
  return insets.top + BAR_HEIGHT + (withTabs ? TABS_HEIGHT : 0);
}

/**
 * The bar over a feed: something on the left, the screen's name or mark in the middle, an action on
 * the right, and optional tabs under it. The top row slides up out of the way as the feed scrolls
 * down, and the tabs stay pinned, as on X.
 */
export function TopBar({
  left,
  title,
  right,
  tabs,
}: {
  left?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  tabs?: { labels: string[]; index: number; onChange: (index: number) => void };
}) {
  const insets = useSafeAreaInsets();
  const { hidden } = useChrome();

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: -hidden.value * BAR_HEIGHT }] }));
  const fade = useAnimatedStyle(() => ({ opacity: interpolate(hidden.value, [0, 0.6], [1, 0]) }));

  return (
    <>
      <Animated.View style={[styles.wrap, { paddingTop: insets.top }, slide]}>
        <Animated.View style={[styles.row, fade]}>
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
        {tabs ? <TopTabs {...tabs} /> : <View style={styles.rule} />}
      </Animated.View>
      <View style={[styles.statusShade, { height: insets.top }]} pointerEvents="none" />
    </>
  );
}

function TopTabs({ labels, index, onChange }: { labels: string[]; index: number; onChange: (index: number) => void }) {
  const [widths, setWidths] = useState<{ x: number; width: number }[]>([]);
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withSpring(index, motion.settle);
  }, [index, position]);

  const ready = widths.length === labels.length && widths.every(Boolean);
  const inputs = labels.map((_, i) => i);
  const lefts = ready ? widths.map((w) => w.x) : inputs.map(() => 0);
  const sizes = ready ? widths.map((w) => w.width) : inputs.map(() => 0);

  const underline = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0,
    left: interpolate(position.value, inputs, lefts),
    width: interpolate(position.value, inputs, sizes),
  }));

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {labels.map((label, i) => {
        const selected = i === index;
        return (
          <Pressable
            key={label}
            style={styles.tab}
            onPress={() => {
              if (!selected) Haptics.selectionAsync();
              onChange(i);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setWidths((previous) => {
                const next = [...previous];
                next[i] = { x: x + width / 2 - Math.min(width - 32, 64) / 2, width: Math.min(width - 32, 64) };
                return next;
              });
            }}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.underline, underline]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(20, 18, 15, 0.96)',
  },
  statusShade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11, backgroundColor: color.paper },
  row: { height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg },
  side: { width: 64, flexDirection: 'row', alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  middle: { flex: 1, alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 19, letterSpacing: -0.4, color: color.ink },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.rule },
  tabs: {
    height: TABS_HEIGHT,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.rule,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: font.medium, fontSize: 15, color: color.pencil },
  tabLabelSelected: { fontFamily: font.bold, color: color.ink },
  underline: { position: 'absolute', bottom: 0, height: 4, borderRadius: 2, backgroundColor: color.action },
});
