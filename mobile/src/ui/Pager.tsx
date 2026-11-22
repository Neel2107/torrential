import * as Haptics from 'expo-haptics';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { color, font, motion } from '@/theme';

const TAB_PAD = 16;
const NEIGHBOURS_AFTER_MS = 400;
const GLIDE = { duration: 260, easing: motion.out };

/** Which page shows, in pages, fractional mid-swipe. */
export function usePagerPosition(index: number): SharedValue<number> {
  return useSharedValue(index);
}

export function Pager({
  index,
  onIndex,
  position,
  preload = true,
  children,
}: {
  index: number;
  onIndex: (index: number) => void;
  position: SharedValue<number>;
  /** Mount the pages beside the current one soon after it settles; otherwise only as a swipe nears them. */
  preload?: boolean;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const settled = useRef(index);
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([index]));

  const near = (page: number) => setMounted((seen) => (seen.has(page) ? seen : new Set([...seen, page])));
  const asked = useSharedValue(1 << index);

  useEffect(() => {
    near(index);
    if (!preload) return;
    const timer = setTimeout(() => setMounted((seen) => new Set([...seen, index - 1, index + 1])), NEIGHBOURS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [index, preload]);

  useEffect(() => {
    if (settled.current === index) return;
    settled.current = index;
    scroll.current?.scrollTo({ x: index * width, animated: false });
  }, [index, scroll, width]);

  const land = (page: number) => {
    if (page === settled.current) return;
    settled.current = page;
    Haptics.selectionAsync();
    onIndex(page);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const at = event.contentOffset.x / width;
      position.value = at;
      for (const page of [Math.floor(at), Math.ceil(at)]) {
        if (page < 0 || asked.value & (1 << page)) continue;
        asked.value |= 1 << page;
        scheduleOnRN(near, page);
      }
    },
    onMomentumEnd: (event) => {
      scheduleOnRN(land, Math.round(event.contentOffset.x / width));
    },
  });

  return (
    <Animated.ScrollView
      ref={scroll}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentOffset={{ x: index * width, y: 0 }}
      style={styles.pager}
    >
      {Children.map(children, (page, at) => (
        <View style={{ width }}>{mounted.has(at) ? page : null}</View>
      ))}
    </Animated.ScrollView>
  );
}

export function TabStrip({
  labels,
  index,
  position,
  onChange,
  scroll = false,
  glide = false,
  style,
}: {
  labels: string[];
  index: number;
  position: SharedValue<number>;
  onChange: (index: number) => void;
  /** Tabs as wide as their labels in a strip that scrolls, for more tabs than fit. */
  scroll?: boolean;
  /** The underline slides to a tapped tab instead of jumping with the content. */
  glide?: boolean;
  style?: ViewStyle;
}) {
  const [spots, setSpots] = useState<({ x: number; width: number } | undefined)[]>([]);
  const strip = useAnimatedRef<Animated.ScrollView>();
  const [stripWidth, setStripWidth] = useState(0);
  const ready = spots.length === labels.length && spots.every(Boolean);
  const inputs = labels.map((_, i) => i);
  const lefts = ready ? spots.map((spot) => spot!.x) : inputs.map(() => 0);
  const sizes = ready ? spots.map((spot) => spot!.width) : inputs.map(() => 0);

  const underline = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0,
    left: interpolate(position.value, inputs, lefts),
    width: interpolate(position.value, inputs, sizes),
  }));

  const spot = spots[index];
  useEffect(() => {
    if (!scroll || !spot || !stripWidth) return;
    strip.current?.scrollTo({ x: Math.max(0, spot.x + spot.width / 2 - stripWidth / 2), animated: true });
  }, [scroll, spot, stripWidth, strip]);

  const tabs = labels.map((label, i) => (
    <Pressable
      key={label}
      style={scroll ? styles.tabScroll : styles.tab}
      onPress={() => {
        if (i === index) return;
        Haptics.selectionAsync();
        position.value = glide ? withTiming(i, GLIDE) : i;
        onChange(i);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: i === index }}
      accessibilityLabel={label}
      onLayout={(event) => {
        const { x, width } = event.nativeEvent.layout;
        const line = scroll ? width - TAB_PAD * 2 : Math.min(width - 24, 72);
        setSpots((previous) => {
          const next = [...previous];
          next[i] = { x: x + (width - line) / 2, width: line };
          return next;
        });
      }}
    >
      <TabLabel label={label} at={i} position={position} />
    </Pressable>
  ));

  if (!scroll) {
    return (
      <View style={[styles.tabs, style]} accessibilityRole="tablist">
        {tabs}
        <Animated.View style={[styles.underline, underline]} />
      </View>
    );
  }
  return (
    <Animated.ScrollView
      ref={strip}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}
      style={[styles.tabs, style]}
      contentContainerStyle={styles.tabsScroll}
      accessibilityRole="tablist"
    >
      {tabs}
      <Animated.View style={[styles.underline, underline]} />
    </Animated.ScrollView>
  );
}

function TabLabel({ label, at, position }: { label: string; at: number; position: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(position.value - at));
    return { color: interpolateColor(near, [0, 1], [color.pencil, color.ink]) };
  });
  return (
    <Animated.Text style={[styles.label, style]} numberOfLines={1}>
      {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.rule },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 48 },
  tabsScroll: { paddingHorizontal: 4 },
  tabScroll: { alignItems: 'center', justifyContent: 'center', height: 48, paddingHorizontal: TAB_PAD },
  label: { fontFamily: font.bold, fontSize: 15 },
  underline: { position: 'absolute', bottom: 0, height: 4, borderRadius: 2, backgroundColor: color.action },
});
