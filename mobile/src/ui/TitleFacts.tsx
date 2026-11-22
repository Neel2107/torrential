import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { color, space, type } from '@/theme';

import { Icon, icons } from './Icon';

const STACK_FROM_FONT_SCALE = 1.15;

/**
 * A title's rating and facts, showing only the ones it has. The star stays with its number.
 * On a card the facts stay inside the card's column: one line at normal sizes, stacked and clamped when the text is large.
 */
export function TitleFacts({
  rating,
  facts,
  size = 'card',
}: {
  rating?: number | null;
  facts: string[];
  size?: 'card' | 'page';
}) {
  const { fontScale } = useWindowDimensions();
  const shown = rating ? rating.toFixed(1) : null;

  if (!shown && facts.length === 0) return null;

  if (size === 'page') {
    return (
      <View style={styles.page}>
        {shown ? (
          <View style={styles.rating}>
            <Icon name={icons.star} size={13} tint={color.action} filled />
            <Text style={[type.numeric, { color: color.ink }]}>{shown}</Text>
          </View>
        ) : null}
        {facts.length > 0 ? <Text style={[type.label, styles.rest]}>{facts.join('  ·  ')}</Text> : null}
      </View>
    );
  }

  const stacked = fontScale > STACK_FROM_FONT_SCALE;
  const rest = facts.join(' · ');

  return (
    <View style={stacked ? styles.stacked : styles.card}>
      {shown ? (
        <View style={styles.rating}>
          <Icon name={icons.star} size={11} tint={color.action} filled />
          <Text style={type.caption} numberOfLines={1}>
            {shown}
          </Text>
        </View>
      ) : null}
      {shown && rest && !stacked ? <Text style={type.caption}>·</Text> : null}
      {rest ? (
        <Text style={[type.caption, styles.rest]} numberOfLines={stacked ? 2 : 1}>
          {rest}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  stacked: { alignItems: 'flex-start', gap: 1, marginTop: 1 },
  page: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm, flexWrap: 'wrap' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  rest: { flexShrink: 1 },
});
