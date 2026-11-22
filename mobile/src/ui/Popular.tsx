import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { TitleCard } from '@web/wire';

import { usePopular } from '@/engine/queries';
import { space } from '@/theme';

import { Poster } from './PosterGrid';
import { rise } from './rise';
import { SectionHeading } from './SectionHeading';

const POSTER = 118;
const SHOWN = 20;
const AFTER_HOME_MS = 600;

/** A row of what is popular now, of one kind, leaving out what the person already has. */
export function PopularRow({
  kind,
  title,
  skip,
  index,
}: {
  kind: 'film' | 'series';
  title: string;
  skip: ReadonlySet<string>;
  index: number;
}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), AFTER_HOME_MS);

    return () => clearTimeout(timer);
  }, []);
  const popular = usePopular(kind, settled);
  const titles: TitleCard[] = (popular.data?.titles ?? []).filter((card) => !skip.has(card.id)).slice(0, SHOWN);

  if (titles.length === 0) return null;

  return (
    <Animated.View entering={rise(index)} style={styles.section}>
      <SectionHeading title={title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {titles.map((card) => (
          <Poster key={card.id} title={card} width={POSTER} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg, gap: space.xs },
  row: { paddingHorizontal: space.page, gap: space.md },
});
