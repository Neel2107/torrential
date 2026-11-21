import { Link, router } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { cardFacts } from '@web/titles/words';
import type { TitleCard } from '@web/wire';

import { usePrefetchTitle } from '@/engine/queries';
import { color, radius, space, type } from '@/theme';

import { Art } from './Art';
import { HERO, useHeroSource } from './hero';
import { Icon, icons } from './Icon';
import { Tap } from './Tap';

/** Posters in columns that fit the screen: three on a phone, more on a tablet or held sideways. */
export function PosterGrid({ titles }: { titles: TitleCard[] }) {
  const { width } = useWindowDimensions();
  const columns = Math.max(3, Math.floor((width - space.page * 2) / 150));
  const gap = space.md;
  // Whole points: three fractional widths can round past the row and push the last poster down a line.
  const itemWidth = Math.floor((width - space.page * 2 - gap * (columns - 1)) / columns);

  return (
    <View style={[styles.grid, { gap, paddingHorizontal: space.page }]}>
      {titles.map((title) => (
        <Poster key={title.id} title={title} width={itemWidth} />
      ))}
    </View>
  );
}

/**
 * A poster that opens its title page, carrying the poster across: Apple's zoom on iOS, which also
 * shrinks back on a swipe down, and the hero flight on Android.
 */
export function Poster({ title, width }: { title: TitleCard; width: number }) {
  const { ref, open } = useHeroSource(title.id);
  const prefetch = usePrefetchTitle();
  const href = { pathname: '/title/[id]', params: { id: title.id } } as const;
  const card = (
    <Tap
      shrink={0.95}
      onPressIn={() => prefetch(title.id)}
      onPress={HERO ? () => open(() => router.push(href)) : undefined}
      accessibilityLabel={[title.name, cardFacts(title)].filter(Boolean).join(', ')}
      style={{ width }}
    >
      <Link.AppleZoom>
        <View ref={ref} collapsable={false}>
          <Art
            id={title.id}
            kind="poster"
            name={title.name}
            style={StyleSheet.flatten([styles.poster, { height: width * 1.5 }])}
          />
        </View>
      </Link.AppleZoom>
      <Text style={[type.label, styles.name]} numberOfLines={2}>
        {title.name}
      </Text>
      <View style={styles.facts}>
        {title.rating ? (
          <>
            <Icon name={icons.star} size={11} tint={color.action} filled />
            <Text style={type.caption}>{title.rating.toFixed(1)}</Text>
            <Text style={type.caption}>·</Text>
          </>
        ) : null}
        <Text style={type.caption} numberOfLines={1}>
          {cardFacts(title)}
        </Text>
      </View>
    </Tap>
  );
  return HERO ? (
    card
  ) : (
    <Link href={href} asChild>
      {card}
    </Link>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  poster: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  name: { color: color.ink, marginTop: space.sm },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
});
