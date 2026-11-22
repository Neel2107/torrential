import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { bytes } from '@web/lib/format';
import { readable } from '@web/lib/release';
import type { Release } from '@web/wire';

import { Icon, icons } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Tap } from '@/ui/Tap';
import { color, font, radius, space, type } from '@/theme';

/** The web player's speeds. Its `actions.ts` imports React, which would load a second copy from the web app. */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
function speedText(speed: number): string {
  return speed === 1 ? 'Normal' : `${speed}×`;
}

/** The player's settings: the source of a title and the speed. Subtitles are set where they are chosen. */
export function SettingsSheet({
  source,
  onSources,
  speed,
  onSpeed,
  onClose,
}: {
  /** The release playing, for a title play, whose other sources can take over. */
  source: Release | null;
  onSources: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.title, styles.heading]}>Settings</Text>

        {source ? (
          <Tap shrink={1} highlight haptic onPress={onSources} accessibilityLabel="Other sources" style={styles.link}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.headline}>Source</Text>
              <Text style={type.caption} numberOfLines={1}>
                {[
                  readable(source.name).title,
                  source.quality.resolution?.toUpperCase(),
                  source.size && bytes(source.size),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Text style={type.label}>Change</Text>
            <Icon name={icons.chevron} size={20} tint={color.pencil} />
          </Tap>
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
      </ScrollView>
    </Sheet>
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
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
    borderRadius: 12,
  },
});
