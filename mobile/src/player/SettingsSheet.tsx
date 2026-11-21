import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { SubtitleBacking, SubtitleStyle } from '@web/lib/storage';

import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { color, font, radius, space, type } from '@/theme';

/** The web player's speeds. Its `actions.ts` imports React, which would load a second copy from the web app. */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SIZES: [short: string, label: string, scale: number][] = [
  ['S', 'Small', 0.8],
  ['M', 'Medium', 1],
  ['L', 'Large', 1.3],
  ['XL', 'Extra large', 1.65],
];
const BACKINGS: [label: string, backing: SubtitleBacking][] = [
  ['Shadow', 'shadow'],
  ['Outline', 'outline'],
  ['Box', 'box'],
];
const SHIFTS = [-0.5, -0.1, 0.1, 0.5];

/** `0.3 s later`, `2.5 s earlier`, or `In sync`, as the web player words it. */
function offsetText(seconds: number): string {
  if (seconds === 0) return 'In sync';
  return `${Math.abs(seconds).toFixed(1)} s ${seconds > 0 ? 'later' : 'earlier'}`;
}

function speedText(speed: number): string {
  return speed === 1 ? 'Normal' : `${speed}×`;
}

/** The player's settings: speed, and the timing and look of drawn subtitles. */
export function SettingsSheet({
  speed,
  onSpeed,
  offset,
  onShift,
  style,
  onStyle,
  onClose,
}: {
  speed: number;
  onSpeed: (speed: number) => void;
  /** Seconds the drawn subtitles show later than written, or null when none are drawn. */
  offset: number | null;
  onShift: (seconds: number) => void;
  style: SubtitleStyle;
  onStyle: (change: Partial<SubtitleStyle>) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.title, styles.heading]}>Settings</Text>

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

        <Section title="Subtitle timing" value={offset === null ? null : offsetText(offset)}>
          {offset === null ? (
            <Text style={type.caption}>Turn on a subtitle file or an online subtitle to shift its timing.</Text>
          ) : (
            <View style={styles.chips}>
              {SHIFTS.map((shift) => (
                <Chip
                  key={shift}
                  label={`${shift > 0 ? '+' : '−'}${Math.abs(shift)} s`}
                  selected={false}
                  onPress={() => onShift(Math.round((offset + shift) * 10) / 10)}
                  accessibilityLabel={`Show subtitles ${Math.abs(shift)} seconds ${shift > 0 ? 'later' : 'earlier'}`}
                />
              ))}
              {offset !== 0 ? (
                <Chip
                  label="Reset"
                  selected={false}
                  onPress={() => onShift(0)}
                  accessibilityLabel="Put subtitles back in sync"
                />
              ) : null}
            </View>
          )}
        </Section>

        <Section title="Subtitle size">
          <View style={styles.chips}>
            {SIZES.map(([short, label, scale]) => (
              <Chip
                key={short}
                label={short}
                selected={style.scale === scale}
                onPress={() => onStyle({ scale })}
                accessibilityLabel={`${label} subtitles`}
              />
            ))}
          </View>
        </Section>

        <Section title="Subtitle background">
          <View style={styles.chips}>
            {BACKINGS.map(([label, backing]) => (
              <Chip
                key={backing}
                label={label}
                selected={style.backing === backing}
                onPress={() => onStyle({ backing })}
                accessibilityLabel={`${label} behind subtitles`}
              />
            ))}
          </View>
        </Section>
      </ScrollView>
    </Sheet>
  );
}

function Section({ title, value, children }: { title: string; value?: string | null; children: ReactNode }) {
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

function Chip({
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
  return (
    <Tap
      shrink={0.92}
      haptic
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingBottom: space.sm, gap: space.lg },
  heading: { marginBottom: -space.xs },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
  chipSelected: { backgroundColor: color.ink },
  chipText: { fontFamily: font.semibold, fontSize: 14, color: color.soft, fontVariant: ['tabular-nums'] },
  chipTextSelected: { color: color.paper },
});
