import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, space, stageType, type as themedType } from '@/theme';

import { Icon, icons } from './Icon';
import { SHEET_CHROME, SHEET_SHARE } from './Sheet';
import { useStaged, useTone } from './stage';
import { Tap } from './Tap';

const RESIZE = { duration: 340, dampingRatio: 1 } as const;
const SHIFT = 14;

type Layer<K extends string> = { key: K; depth: number; side: 1 | -1 };

/** The room a sheet leaves for its content, so a page knows where to start scrolling. */
export function useSheetRoom(): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return Math.floor(height * SHEET_SHARE - SHEET_CHROME - insets.bottom - space.lg);
}

/**
 * Pages inside a sheet, one at a time. Every page stands on its own layer, so the sheet's height is always the shown
 * page's, eased whenever it changes: another page, or the same page growing. Moving deeper, the old page fades away
 * toward the left before the new one comes in from the right; going back runs the other way.
 */
export function Pages<K extends string>({
  page,
  depth,
  children,
}: {
  page: K;
  depth: number;
  children: (page: K) => ReactNode;
}) {
  const room = useSheetRoom();
  const [layers, setLayers] = useState<Layer<K>[]>([{ key: page, depth, side: 1 }]);
  const height = useSharedValue(-1);
  const [moved, setMoved] = useState(false);
  const current = layers[layers.length - 1]!;

  if (current.key !== page) {
    const side = depth >= current.depth ? 1 : -1;
    setLayers([...layers.filter((layer) => layer.key !== page), { key: page, depth, side }]);
    setMoved(true);
  }

  const gone = (key: K) => setLayers((now) => now.filter((layer) => layer.key !== key || layer === now.at(-1)));

  const measured = (key: K, value: number) => {
    if (key !== page) return;

    if (height.get() < 0) height.set(value);
    else height.set(withSpring(value, RESIZE));
  };

  const frame = useAnimatedStyle(() => ({ height: Math.max(0, height.get()) }));

  return (
    <Animated.View style={[styles.clip, frame]}>
      {layers.map((layer) => (
        <Page
          key={layer.key}
          active={layer.key === page}
          arrives={moved}
          side={layer.side}
          room={room}
          onHeight={(value) => measured(layer.key, value)}
          onGone={() => gone(layer.key)}
        >
          {children(layer.key)}
        </Page>
      ))}
    </Animated.View>
  );
}

function Page({
  active,
  arrives,
  side,
  room,
  onHeight,
  onGone,
  children,
}: {
  active: boolean;
  arrives: boolean;
  side: 1 | -1;
  room: number;
  onHeight: (height: number) => void;
  onGone: () => void;
  children: ReactNode;
}) {
  const [first] = useState(() => !arrives);
  const shown = useSharedValue(first ? 1 : 0);
  const toward = useSharedValue<number>(side);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!opened) {
      setOpened(true);

      if (first) return;
    }

    if (active) {
      toward.set(side);
      shown.set(withDelay(40, withTiming(1, { duration: 220, easing: motion.out })));
    } else {
      toward.set(-side);
      shown.set(withTiming(0, { duration: 140, easing: Easing.linear }, (done) => done && scheduleOnRN(onGone)));
    }
  }, [active]);

  const look = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: (1 - shown.get()) * SHIFT * toward.get() }],
  }));

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!active}
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      style={[styles.layer, { maxHeight: room }, look]}
    >
      {children}
    </Animated.View>
  );
}

/** The top of a page below the first: a back arrow and the page's name, with an optional line under it. */
export function PageHeader({ title, detail, onBack }: { title: string; detail?: string; onBack: () => void }) {
  const tone = useTone();
  const type = useStaged(themedType, stageType);

  return (
    <View style={styles.header}>
      <Tap shrink={0.97} onPress={onBack} accessibilityLabel={`Back from ${title}`} style={styles.back}>
        <Icon name={icons.back} size={20} tint={tone.ink} />
        <Text style={type.title} accessibilityRole="header">
          {title}
        </Text>
      </Tap>
      {detail ? <Text style={[type.caption, styles.detail]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingBottom: space.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, alignSelf: 'flex-start' },
  detail: { marginLeft: 20 + space.sm },
  clip: { overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
