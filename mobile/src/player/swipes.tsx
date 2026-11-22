import * as Brightness from 'expo-brightness';
import { Sun, Volume2, VolumeX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { VolumeManager } from 'react-native-volume-manager';

import { Icon } from '@/ui/Icon';
import { stage as color, font, motion, radius, space } from '@/theme';

const SIDE = 0.4;
const TRAVEL = 1;

type Kind = 'brightness' | 'volume';

export function useSideSwipes({ width, height }: { width: number; height: number }) {
  const [kind, setKind] = useState<Kind>('brightness');
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
    level.value = now;
    shown.value = withTiming(1, { duration: motion.press });
  };

  const move = (side: Kind, translationY: number) => {
    const next = Math.min(1, Math.max(0, start.current - (translationY / height) * TRAVEL));
    level.value = next;
    const percent = Math.round(next * 100);
    if (percent === written.current) return;
    written.current = percent;
    if (side === 'brightness') Brightness.setBrightnessAsync(Math.max(0.01, next)).catch(() => {});
    else VolumeManager.setVolume(next, { showUI: false }).catch(() => {});
  };

  const end = () => {
    shown.value = withDelay(500, withTiming(0, { duration: motion.standard }));
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

  return { swipe, kind, level, shown, middle: { left: -width * SIDE, right: -width * SIDE } };
}

export function SwipeLevel({
  kind,
  level,
  shown,
}: {
  kind: Kind;
  level: ReturnType<typeof useSideSwipes>['level'];
  shown: ReturnType<typeof useSideSwipes>['shown'];
}) {
  const [percent, setPercent] = useState(0);
  const fill = useAnimatedStyle(() => ({ height: `${Math.round(level.value * 100)}%` }));
  const pill = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: 0.92 + shown.value * 0.08 }] }));

  useEffect(() => {
    const timer = setInterval(() => setPercent(Math.round(level.value * 100)), 80);
    return () => clearInterval(timer);
  }, [level]);

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
