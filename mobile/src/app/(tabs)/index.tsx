import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minutesLeft } from '@web/lib/format';
import { episodeCode, episodeName } from '@web/titles/words';
import type { Continue, TitleCard } from '@web/wire';

import { useHome } from '@/engine/queries';
import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { EngineProblem } from '@/ui/EngineProblem';
import { Icon, icons } from '@/ui/Icon';
import { Meter } from '@/ui/Meter';
import { PosterGrid } from '@/ui/PosterGrid';
import { Skeleton } from '@/ui/Skeleton';
import { Tap } from '@/ui/Tap';
import { color, radius, space, type } from '@/theme';

export default function Home() {
  const home = useHome();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await home.refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space.xxl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.soft} colors={[color.action]} progressBackgroundColor={color.lifted} progressViewOffset={insets.top} />
      }
    >
      <Header />
      {home.isPending ? (
        <Loading />
      ) : home.isError ? (
        <EngineProblem error={home.error} onRetry={() => home.refetch()} />
      ) : home.data.continue.length === 0 && home.data.saved.length === 0 ? (
        <Empty />
      ) : (
        <Animated.View entering={FadeIn.duration(220)}>
          {home.data.continue.length > 0 ? <Hero item={home.data.continue[0]!} /> : null}
          {home.data.continue.length > 1 ? <ContinueRail items={home.data.continue.slice(1)} /> : null}
          {home.data.saved.length > 0 ? <Saved titles={home.data.saved} /> : null}
        </Animated.View>
      )}
    </ScrollView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.wordmark} accessibilityRole="header">
        torrential
      </Text>
      <Tap
        haptic
        onPress={() => router.push('/tv')}
        accessibilityLabel="Play on TV"
        style={styles.headerButton}
      >
        <Icon name={icons.cast} size={22} tint={color.soft} />
      </Tap>
    </View>
  );
}

function progressOf(item: Continue): number | null {
  return item.resume_at !== null && item.duration ? item.resume_at / item.duration : null;
}

function subtitleOf(item: Continue): string {
  if (item.episode) return `${episodeCode(item.episode)} · ${episodeName(item.episode)}`;
  return item.title.year ? String(item.title.year) : '';
}

function remainingOf(item: Continue): string {
  if (item.resume_at !== null && item.duration) return minutesLeft(item.resume_at, item.duration);
  return item.episode ? 'Next episode' : 'Not started';
}

function play(item: Continue) {
  router.push({ pathname: '/play', params: { video: item.video } });
}

function Hero({ item }: { item: Continue }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - space.page * 2;
  const progress = progressOf(item);

  return (
    <View style={styles.heroWrap}>
      <Tap
        shrink={0.985}
        onPress={() => router.push({ pathname: '/title/[id]', params: { id: item.title.id } })}
        accessibilityLabel={`${item.title.name}, ${subtitleOf(item)}, ${remainingOf(item)}`}
        style={[styles.hero, { width: cardWidth, height: Math.round(cardWidth * 1.15) }]}
      >
        <Art id={item.title.id} kind="poster" name={item.title.name} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['transparent', 'rgba(20,18,15,0.55)', color.paper]}
          locations={[0.35, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBody}>
          <Text style={type.section}>CONTINUE WATCHING</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {item.title.name}
          </Text>
          <Text style={type.label} numberOfLines={1}>
            {subtitleOf(item)}
          </Text>
          <View style={styles.heroActions}>
            <Button label={progress ? 'Resume' : 'Play'} icon={icons.play} onPress={() => play(item)} />
            <View style={styles.heroProgress}>
              {progress !== null ? <Meter fraction={progress} /> : null}
              <Text style={[type.numeric, { color: color.pencil }]}>{remainingOf(item)}</Text>
            </View>
          </View>
        </View>
      </Tap>
    </View>
  );
}

function ContinueRail({ items }: { items: Continue[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(320, Math.round(width * 0.72));

  return (
    <View style={styles.section}>
      <Text style={[type.headline, styles.sectionTitle]} accessibilityRole="header">
        Up next
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + space.md}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: space.page, gap: space.md }}
      >
        {items.map((item) => {
          const progress = progressOf(item);
          return (
            <Tap
              key={item.video}
              shrink={0.97}
              onPress={() => play(item)}
              onLongPress={() => router.push({ pathname: '/title/[id]', params: { id: item.title.id } })}
              accessibilityLabel={`${item.title.name}, ${subtitleOf(item)}, ${remainingOf(item)}`}
              accessibilityHint="Plays it. Long press opens its page."
              style={{ width: cardWidth }}
            >
              <View style={[styles.still, { height: Math.round((cardWidth * 9) / 16) }]}>
                <Art
                  id={item.title.id}
                  kind={item.episode?.thumbnail ? 'thumbnail' : 'background'}
                  season={item.episode?.thumbnail ? item.episode.season : undefined}
                  episode={item.episode?.thumbnail ? item.episode.episode : undefined}
                  name={item.title.name}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.playBadge}>
                  <Icon name={icons.play} size={16} tint={color.ink} />
                </View>
                {progress !== null ? (
                  <View style={styles.stillMeter}>
                    <Meter fraction={progress} />
                  </View>
                ) : null}
              </View>
              <View style={styles.cardText}>
                <Text style={type.callout} numberOfLines={1}>
                  {item.title.name}
                </Text>
                <Text style={type.caption} numberOfLines={1}>
                  {subtitleOf(item)} · {remainingOf(item)}
                </Text>
              </View>
            </Tap>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Saved({ titles }: { titles: TitleCard[] }) {
  return (
    <View style={styles.section}>
      <Text style={[type.headline, styles.sectionTitle]} accessibilityRole="header">
        Saved
      </Text>
      <PosterGrid titles={titles} />
    </View>
  );
}

function Empty() {
  return (
    <View style={styles.empty}>
      <Icon name={icons.film} size={40} tint={color.pencil} />
      <Text style={[type.title, { textAlign: 'center' }]}>Nothing here yet</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>
        Find a film or a show and it starts playing in seconds, while it downloads.
      </Text>
      <Button label="Search" icon={icons.search} onPress={() => router.push('/search')} style={{ marginTop: space.sm }} />
    </View>
  );
}

function Loading() {
  const { width } = useWindowDimensions();
  const cardWidth = width - space.page * 2;
  return (
    <View style={{ paddingHorizontal: space.page, gap: space.xl }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Skeleton style={{ height: Math.round(cardWidth * 1.15), borderRadius: radius.xl }} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Skeleton style={{ flex: 1, aspectRatio: 2 / 3, borderRadius: radius.md }} />
        <Skeleton style={{ flex: 1, aspectRatio: 2 / 3, borderRadius: radius.md }} />
        <Skeleton style={{ flex: 1, aspectRatio: 2 / 3, borderRadius: radius.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.page,
    marginBottom: space.lg,
  },
  wordmark: { ...type.title, fontSize: 24, letterSpacing: -0.6 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.raised,
  },
  heroWrap: { paddingHorizontal: space.page },
  hero: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: color.raised, justifyContent: 'flex-end' },
  heroBody: { padding: space.xl, gap: space.xs },
  heroTitle: { ...type.display, marginTop: space.xs },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  heroProgress: { flex: 1, gap: space.sm },
  section: { marginTop: space.xxl, gap: space.md },
  sectionTitle: { paddingHorizontal: space.page },
  still: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.raised },
  stillMeter: { position: 'absolute', left: space.md, right: space.md, bottom: space.md },
  playBadge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: color.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { paddingTop: space.sm, gap: 2 },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 96 },
});
