import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ago } from '@web/lib/format';
import { videoOf } from '@web/lib/video';
import { episodeCode, episodeName } from '@web/titles/words';
import type { EpisodeInfo, TitleCard, TitlePage } from '@web/wire';

import { get } from '@/engine/client';
import { keys } from '@/engine/queries';
import { useLink } from '@/engine/session';
import { color, radius, space, type } from '@/theme';

import { Art } from './Art';
import { rise } from './rise';
import { Tap } from './Tap';

const RECENT_DAYS = 14;
const SHOWN = 10;
const CARD = 220;
const AFTER_HOME_MS = 800;

type Fresh = { page: TitlePage; episode: EpisodeInfo };

/** Episodes of saved shows that aired in the last two weeks and are not watched yet, newest first. */
function useFresh(saved: TitleCard[]): Fresh[] {
  const link = useLink();
  const [settled, setSettled] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(Date.now()), AFTER_HOME_MS);
    return () => clearTimeout(timer);
  }, []);
  const shows = settled !== null ? saved.filter((title) => title.kind === 'series') : [];
  const pages = useQueries({
    queries: shows.map((show) => ({
      queryKey: [...keys.title(show.id), link.base],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        get<TitlePage>(link, `/api/title?id=${encodeURIComponent(show.id)}`, signal),
      staleTime: 30 * 60_000,
    })),
  });
  const since = (settled ?? 0) / 1000 - RECENT_DAYS * 86_400;
  return pages
    .flatMap(({ data: page }) => {
      if (!page) return [];
      const seen = new Set(page.watched.filter((w) => w.finished).map((w) => w.video));
      return page.seasons
        .filter((season) => season.number > 0)
        .flatMap((season) => season.episodes)
        .filter((episode) => episode.has_aired && episode.aired !== null && episode.aired >= since)
        .filter((episode) => !seen.has(videoOf(page.id, episode)))
        .map((episode) => ({ page, episode }));
    })
    .sort((a, b) => (b.episode.aired ?? 0) - (a.episode.aired ?? 0))
    .slice(0, SHOWN);
}

export function NewEpisodes({ saved, index }: { saved: TitleCard[]; index: number }) {
  const fresh = useFresh(saved);
  if (fresh.length === 0) return null;

  return (
    <Animated.View entering={rise(index)} style={styles.section}>
      <Text style={[type.title, styles.title]} accessibilityRole="header">
        New episodes
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {fresh.map(({ page, episode }) => (
          <Tap
            key={videoOf(page.id, episode)}
            shrink={0.97}
            onPress={() => router.push({ pathname: '/title/[id]', params: { id: page.id } })}
            accessibilityLabel={`${page.name}, ${episodeCode(episode)}, ${episodeName(episode)}, aired ${ago(episode.aired ?? 0)}`}
            accessibilityHint="Opens the show."
            style={{ width: CARD }}
          >
            <View style={styles.still}>
              <Art
                id={page.id}
                kind={episode.thumbnail ? 'thumbnail' : 'background'}
                season={episode.thumbnail ? episode.season : undefined}
                episode={episode.thumbnail ? episode.episode : undefined}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{episodeCode(episode)}</Text>
              </View>
            </View>
            <Text style={type.callout} numberOfLines={1}>
              {page.name}
            </Text>
            <Text style={type.caption} numberOfLines={1}>
              {episodeName(episode)} · {ago(episode.aired ?? 0)}
            </Text>
          </Tap>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, gap: space.md },
  title: { paddingHorizontal: space.page },
  row: { paddingHorizontal: space.page, gap: space.md },
  still: {
    width: CARD,
    height: Math.round((CARD * 9) / 16),
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.raised,
    marginBottom: space.sm,
  },
  badge: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(10, 9, 7, 0.72)',
  },
  badgeText: { ...type.label, color: color.ink },
});
