import * as Brightness from 'expo-brightness';
import Sun from 'lucide-react-native/icons/sun';
import Volume2 from 'lucide-react-native/icons/volume-2';
import VolumeX from 'lucide-react-native/icons/volume-x';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { VolumeManager } from 'react-native-volume-manager';

import { Icon } from '@/ui/Icon';
import { stage as color, font, motion, radius, space } from '@/theme';

const SIDE = 0.4;
const TRAVEL = 1;

type Kind = 'brightness' | 'volume';

type Readout = { get: () => number; set: (percent: number) => void; subscribe: (listener: () => void) => () => void };

/** The percentage the pill shows, kept outside React state so a swipe re-renders only the pill. */
function createReadout(): Readout {
  let percent = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => percent,
    set: (next) => {
      percent = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useSideSwipes({ width, height }: { width: number; height: number }) {
  const [kind, setKind] = useState<Kind>('brightness');
  const [readout] = useState(createReadout);
  const level = useSharedValue(0);
  const shown = useSharedValue(0);
  const start = useRef(0);
  const written = useRef(-1);
  const before = useRef<number | null>(null);

  useEffect(() => {
    Brightness.getBrightnessAsync()
      .then((value) => (before.current = value))
      .catch(() => {});
    return () => {
      if (Platform.OS === 'android') Brightness.restoreSystemBrightnessAsync().catch(() => {});
      else if (before.current !== null) Brightness.setBrightnessAsync(before.current).catch(() => {});
    };
  }, []);

  const begin = async (side: Kind) => {
    setKind(side);
    const now =
      side === 'brightness'
        ? await Brightness.getBrightnessAsync().catch(() => 0.5)
        : ((await VolumeManager.getVolume().catch(() => null))?.volume ?? 0.5);
    start.current = now;
    written.current = Math.round(now * 100);
    readout.set(written.current);
    level.set(now);
    shown.set(withTiming(1, { duration: motion.press }));
  };

  const move = (side: Kind, translationY: number) => {
    const next = Math.min(1, Math.max(0, start.current - (translationY / height) * TRAVEL));
    level.set(next);
    const percent = Math.round(next * 100);
    if (percent === written.current) return;
    written.current = percent;
    readout.set(percent);
    if (side === 'brightness') Brightness.setBrightnessAsync(Math.max(0.01, next)).catch(() => {});
    else VolumeManager.setVolume(next, { showUI: false }).catch(() => {});
  };

  const end = () => {
    shown.set(withDelay(500, withTiming(0, { duration: motion.standard })));
  };

  const side = (which: Kind) =>
    Gesture.Pan()
      .runOnJS(true)
      .hitSlop(which === 'brightness' ? { right: -width * (1 - SIDE) } : { left: -width * (1 - SIDE) })
      .activeOffsetY([-14, 14])
      .failOffsetX([-24, 24])
      .onStart(() => begin(which))
      .onUpdate((event) => move(which, event.translationY))
      .onFinalize(end);
  const swipe = Gesture.Simultaneous(side('brightness'), side('volume'));

  return { swipe, kind, readout, level, shown, middle: { left: -width * SIDE, right: -width * SIDE } };
}

export function SwipeLevel({
  kind,
  readout,
  level,
  shown,
}: {
  kind: Kind;
  readout: Readout;
  level: ReturnType<typeof useSideSwipes>['level'];
  shown: ReturnType<typeof useSideSwipes>['shown'];
}) {
  const fill = useAnimatedStyle(() => ({ height: `${Math.round(level.get() * 100)}%` }));
  const pill = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ scale: 0.92 + shown.get() * 0.08 }] }));

  const percent = useSyncExternalStore(readout.subscribe, readout.get);
  const icon = kind === 'brightness' ? Sun : percent === 0 ? VolumeX : Volume2;
  return (
    <View pointerEvents="none" style={[styles.wrap, kind === 'brightness' ? styles.left : styles.right]}>
      <Animated.View style={[styles.pill, pill]}>
        <Icon name={icon} size={20} tint={color.ink} />
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fill]} />
        </View>
        <Text style={styles.percent}>{percent}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  left: { left: space.xxl * 2 },
  right: { right: space.xxl * 2 },
  pill: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    width: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(20, 18, 15, 0.72)',
  },
  track: {
    width: 6,
    height: 120,
    borderRadius: 3,
    backgroundColor: 'rgba(240, 233, 220, 0.25)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 3, backgroundColor: color.ink },
  percent: { fontFamily: font.semibold, fontSize: 13, color: color.ink, fontVariant: ['tabular-nums'] },
});
