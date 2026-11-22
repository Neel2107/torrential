import { useEffect, useState, type ReactNode } from 'react';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { bytes } from '@web/lib/format';
import { readable } from '@web/lib/release';
import type { Release } from '@web/wire';

import { PageHeader, Pages } from '@/ui/Pages';
import { NavRow } from '@/ui/Row';
import { Sheet } from '@/ui/Sheet';

import { useSources } from './sources';
import { SourcesList } from './SourcesSheet';
import { Tap } from '@/ui/Tap';
import { stage as color, font, motion, radius, space, stageType as type } from '@/theme';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/** When the player pauses for sleep: after some minutes, or at the end of the video. */
export type Sleep = { kind: 'after'; minutes: number; at: number } | { kind: 'end' } | null;

const SLEEPS: [label: string, minutes: number | null][] = [
  ['Off', null],
  ['15 min', 15],
  ['30 min', 30],
  ['1 hour', 60],
  ['End of video', 0],
];

function sleepText(sleep: Sleep): string {
  if (!sleep) return 'Off';

  if (sleep.kind === 'end') return 'At the end';

  return `Pauses in ${Math.max(1, Math.round((sleep.at - Date.now()) / 60_000))} min`;
}

function speedText(speed: number): string {
  return speed === 1 ? 'Normal' : `${speed}×`;
}

export function SettingsSheet({
  source,
  video,
  label,
  onSource,
  speed,
  onSpeed,
  sleep,
  onSleep,
  onClose,
}: {
  source: Release | null;
  video: string | null;
  label: string;
  onSource: (release: Release) => void;
  speed: number;
  onSpeed: (speed: number) => void;
  sleep: Sleep;
  onSleep: (sleep: Sleep) => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<'menu' | 'sources'>('menu');
  useSources(video);

  const menu = (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={[type.title, styles.heading]}>Settings</Text>

      {source ? (
        <NavRow
          label="Source"
          detail={[readable(source.name).title, source.quality.resolution, source.size && bytes(source.size)]
            .filter(Boolean)
            .join(' · ')}
          value="Change"
          onPress={() => setPage('sources')}
          accessibilityLabel="Source. Choose another"
        />
      ) : null}

      <Section title="Speed" value={speedText(speed)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.line}>
          {SPEEDS.map((choice) => (
            <Chip
              key={choice}
              label={speedText(choice)}
              selected={choice === speed}
              onPress={() => onSpeed(choice)}
              accessibilityLabel={choice === 1 ? 'Normal speed' : `${choice} times speed`}
            />
          ))}
        </ScrollView>
      </Section>

      <Section title="Sleep timer" value={sleepText(sleep)}>
        <View style={styles.wrapLine}>
          {SLEEPS.map(([label, minutes]) => (
            <Chip
              key={label}
              label={label}
              selected={
                minutes === null
                  ? sleep === null
                  : minutes === 0
                    ? sleep?.kind === 'end'
                    : sleep?.kind === 'after' && sleep.minutes === minutes
              }
              onPress={() =>
                onSleep(
                  minutes === null
                    ? null
                    : minutes === 0
                      ? { kind: 'end' }
                      : { kind: 'after', minutes, at: Date.now() + minutes * 60_000 },
                )
              }
              accessibilityLabel={minutes === null ? 'No sleep timer' : `Pause ${label.toLowerCase()}`}
            />
          ))}
        </View>
      </Section>
    </ScrollView>
  );

  return (
    <Sheet
      onClose={onClose}
      onBack={() => {
        if (page === 'menu') return false;
        setPage('menu');

        return true;
      }}

      render={(close) => (
        <Pages page={page} depth={page === 'menu' ? 0 : 1}>
          {(shown) =>
            shown === 'menu' || !video ? (
              menu
            ) : (
              <>
                <PageHeader title="Source" detail={label} onBack={() => setPage('menu')} />
                <SourcesList video={video} current={source?.id} onPick={(release) => close(() => onSource(release))} />
              </>
            )
          }
        </Pages>
      )}
    />
  );
}

export function Section({ title, value, children }: { title: string; value?: string | null; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={type.headline}>{title}</Text>
        {value ? <Text style={type.numeric}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: motion.quick, easing: motion.out }));
  }, [selected, on]);

  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [color.lifted, color.ink]),
  }));

  const text = useAnimatedStyle(() => ({ color: interpolateColor(on.get(), [0, 1], [color.soft, color.paper]) }));

  return (
    <Tap
      shrink={0.96}
      haptic
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.chip, fill]}>
        <Animated.Text style={[styles.chipText, text]}>{label}</Animated.Text>
      </Animated.View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.sm, gap: space.lg },
  heading: { marginBottom: -space.xs },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  wrapLine: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', gap: space.sm },
  chip: {
    minWidth: 52,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.lifted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: font.semibold, fontSize: 14, color: color.soft, fontVariant: ['tabular-nums'] },
});
