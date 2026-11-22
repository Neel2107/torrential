import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { sentence } from '@web/lib/format';
import { titleOf } from '@web/lib/video';
import type { Cast } from '@web/wire';

import { useCastControl, useCasts } from '@/engine/queries';
import { alpha, color, motion, radius, space, type } from '@/theme';

import { Art } from './Art';
import { Icon, icons } from './Icon';
import { Tap } from './Tap';
import { reflow, vanishDown } from '@/ui/presets';

const ARRIVE = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: motion.out },
}).duration(motion.standard);

function key(cast: Cast): string {
  return `${cast.tv}:${cast.started_at}`;
}

let dismissed: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function dismiss(cast: Cast) {
  dismissed = new Set(dismissed).add(key(cast));

  for (const listener of listeners) listener();
}

function useDismissed(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => dismissed,
  );
}

export function CastBar({
  bottom,
  hidden,
  travel = 0,
  onHeight,
}: {
  bottom: number;
  hidden?: SharedValue<number>;
  travel?: number;
  onHeight: (height: number) => void;
}) {
  const casts = useCasts();
  const gone = useDismissed();

  const shown = (casts.data?.casts ?? []).filter(
    (cast) => (cast.state !== 'ended' || cast.error) && !gone.has(key(cast)),
  );

  const empty = shown.length === 0;

  useEffect(() => {
    if (empty) onHeight(0);
  }, [empty, onHeight]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: (hidden?.get() ?? 0) * travel }] }));

  if (empty) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.dock, { bottom }, slide]}
      onLayout={(event) => onHeight(event.nativeEvent.layout.height + space.sm)}
    >
      {shown.map((cast) =>
        cast.state === 'ended' ? <Failed key={key(cast)} cast={cast} /> : <Live key={key(cast)} cast={cast} />,
      )}
    </Animated.View>
  );
}

function Live({ cast }: { cast: Cast }) {
  const control = useCastControl();
  const started = cast.state === 'playing' || cast.state === 'paused';
  const playing = cast.state === 'playing';

  const status = control.error
    ? sentence(control.error.message)
    : cast.state === 'finding'
      ? 'Finding a source'
      : cast.state === 'loading'
        ? `Starting on ${cast.tv_name}`
        : `${playing ? 'Playing' : 'Paused'} on ${cast.tv_name}`;

  return (
    <Animated.View entering={ARRIVE} exiting={vanishDown} layout={reflow} style={styles.float}>
      <Tap
        shrink={0.98}
        onPress={() => router.push('/tv')}
        accessibilityLabel={`${cast.name}, ${status}`}
        accessibilityHint="Opens the remote."
        style={styles.card}
      >
        <Thumb cast={cast} />
        <View style={styles.words}>
          <Text style={type.callout} numberOfLines={1}>
            {cast.name}
          </Text>
          <Text style={[type.caption, control.error && { color: color.error }]} numberOfLines={1}>
            {status}
          </Text>
        </View>
        {started ? (
          <Tap
            shrink={0.84}
            disabled={control.isPending}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              control.mutate({ tv: cast.tv, action: playing ? 'pause' : 'resume' });
            }}
            accessibilityLabel={playing ? 'Pause on the TV' : 'Play on the TV'}
            style={styles.button}
          >
            <Icon name={playing ? icons.pause : icons.play} size={24} tint={color.ink} filled />
          </Tap>
        ) : (
          <View style={styles.button}>
            <ActivityIndicator size="small" color={color.soft} />
          </View>
        )}
        <Line fraction={cast.duration ? (cast.position ?? 0) / cast.duration : 0} />
      </Tap>
    </Animated.View>
  );
}

function Failed({ cast }: { cast: Extract<Cast, { state: 'ended' }> }) {
  return (
    <Animated.View
      entering={ARRIVE}
      exiting={vanishDown}
      layout={reflow}
      accessibilityRole="alert"
      style={[styles.card, styles.float]}
    >
      <View style={[styles.thumb, styles.thumbFailed]}>
        <Icon name={icons.warning} size={20} tint={color.error} />
      </View>
      <View style={styles.words}>
        <Text style={type.callout} numberOfLines={1}>
          {cast.name} stopped on {cast.tv_name}
        </Text>
        {cast.error ? (
          <Text style={type.caption} numberOfLines={2}>
            {sentence(cast.error.message)}
          </Text>
        ) : null}
      </View>
      <Tap shrink={0.84} haptic onPress={() => dismiss(cast)} accessibilityLabel="Dismiss" style={styles.button}>
        <Icon name={icons.close} size={20} tint={color.soft} />
      </Tap>
    </Animated.View>
  );
}

function Thumb({ cast }: { cast: Cast }) {
  if (cast.video) return <Art id={titleOf(cast.video)} kind="poster" style={styles.thumb} />;

  return (
    <View style={styles.thumb}>
      <Icon name={icons.tv} size={20} tint={color.soft} />
    </View>
  );
}

function Line({ fraction }: { fraction: number }) {
  const value = useDerivedValue(() =>
    withTiming(Math.min(1, Math.max(0, fraction)), { duration: motion.tick, easing: Easing.linear }),
  );

  const fill = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View style={styles.line} pointerEvents="none">
      <Animated.View style={[styles.lineFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: space.sm, right: space.sm, gap: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingLeft: space.sm,
    paddingRight: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.lifted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.rule,
  },
  /** The shadow sits outside the card, since the card clips its progress line to its corners. */
  float: {
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  thumb: {
    width: 30,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  thumbFailed: { width: 44, borderRadius: 22, backgroundColor: alpha(color.error, 0.14) },
  words: { flex: 1, gap: 1 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: alpha(color.ink, 0.1),
  },
  lineFill: { height: 2, backgroundColor: color.action },
});
