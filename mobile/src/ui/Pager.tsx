import * as Haptics from 'expo-haptics';
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { color, font } from '@/theme';

/** Which page shows, in pages, fractional mid-swipe. */
export function usePagerPosition(index: number): SharedValue<number> {
  return useSharedValue(index);
}

export function Pager({
  index,
  onIndex,
  position,
  children,
}: {
  index: number;
  onIndex: (index: number) => void;
  position: SharedValue<number>;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const settled = useRef(index);

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
      position.value = event.contentOffset.x / width;
    },
    onMomentumEnd: (event) => {
      runOnJS(land)(Math.round(event.contentOffset.x / width));
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
      {Children.map(children, (page) => (
        <View style={{ width }}>{page}</View>
      ))}
    </Animated.ScrollView>
  );
}

export function TabStrip({
  labels,
  index,
  position,
  onChange,
  style,
}: {
  labels: string[];
  index: number;
  position: SharedValue<number>;
  onChange: (index: number) => void;
  style?: ViewStyle;
}) {
  const [spots, setSpots] = useState<({ x: number; width: number } | undefined)[]>([]);
  const ready = spots.length === labels.length && spots.every(Boolean);
  const inputs = labels.map((_, i) => i);
  const lefts = ready ? spots.map((spot) => spot!.x) : inputs.map(() => 0);
  const sizes = ready ? spots.map((spot) => spot!.width) : inputs.map(() => 0);

  const underline = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0,
    left: interpolate(position.value, inputs, lefts),
    width: interpolate(position.value, inputs, sizes),
  }));

  return (
    <View style={[styles.tabs, style]} accessibilityRole="tablist">
      {labels.map((label, i) => (
        <Pressable
          key={label}
          style={styles.tab}
          onPress={() => {
            if (i === index) return;
            Haptics.selectionAsync();
            position.value = i;
            onChange(i);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === index }}
          accessibilityLabel={label}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            const line = Math.min(width - 24, 72);
            setSpots((previous) => {
              const next = [...previous];
              next[i] = { x: x + (width - line) / 2, width: line };
              return next;
            });
          }}
        >
          <TabLabel label={label} at={i} position={position} />
        </Pressable>
      ))}
      <Animated.View style={[styles.underline, underline]} />
    </View>
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
  label: { fontFamily: font.bold, fontSize: 15 },
  underline: { position: 'absolute', bottom: 0, height: 4, borderRadius: 2, backgroundColor: color.action },
});
