import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { cardFacts } from '@web/titles/words';
import type { TitleCard } from '@web/wire';

import { color, DENSE_TEXT_SCALE, radius, space, type } from '@/theme';

import { Art } from './Art';
import { TitleFacts } from './TitleFacts';
import { TitlePoster, TitleTap } from './TitleTap';

export function PosterGrid({ titles }: { titles: TitleCard[] }) {
  const { width } = useWindowDimensions();
  const columns = Math.max(3, Math.floor((width - space.page * 2) / 150));
  const gap = space.md;
  /** Whole points: three fractional widths can round past the row and push the last poster down a line. */
  const itemWidth = Math.floor((width - space.page * 2 - gap * (columns - 1)) / columns);

  return (
    <View style={[styles.grid, { gap, paddingHorizontal: space.page }]}>
      {titles.map((title) => (
        <Poster key={title.id} title={title} width={itemWidth} />
      ))}
    </View>
  );
}

/** A poster and its caption: name, rating and year. A caption is narrow, so it leaves out "Series", which the label read aloud still says. */
export function Poster({ title, width }: { title: TitleCard; width: number }) {
  return (
    <TitleTap
      id={title.id}
      shrink={0.95}
      accessibilityLabel={[title.name, title.rating ? `rated ${title.rating.toFixed(1)}` : null, cardFacts(title)]
        .filter(Boolean)
        .join(', ')}
      style={{ width }}
    >
      <TitlePoster>
        <Art
          id={title.id}
          kind="poster"
          name={title.name}
          style={StyleSheet.flatten([styles.poster, { height: width * 1.5 }])}
        />
      </TitlePoster>
      <Text style={[type.label, styles.name]} numberOfLines={2} maxFontSizeMultiplier={DENSE_TEXT_SCALE}>
        {title.name}
      </Text>
      <TitleFacts rating={title.rating} facts={title.year ? [String(title.year)] : []} />
    </TitleTap>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  poster: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  name: { color: color.ink, marginTop: space.sm },
});
