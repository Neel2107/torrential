import { StyleSheet, Text, View } from 'react-native';

import type { SubtitleBacking, SubtitleStyle } from '@web/lib/storage';

import { space, type } from '@/theme';

import { Chip, Section } from './SettingsSheet';

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

function offsetText(seconds: number): string {
  if (seconds === 0) return 'In sync';
  return `${Math.abs(seconds).toFixed(1)} s ${seconds > 0 ? 'later' : 'earlier'}`;
}

export function SubtitleLook({
  offset,
  onShift,
  style,
  onStyle,
}: {
  offset: number | null;
  onShift: (seconds: number) => void;
  style: SubtitleStyle;
  onStyle: (change: Partial<SubtitleStyle>) => void;
}) {
  return (
    <View style={styles.look}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  look: { gap: space.lg, marginTop: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
