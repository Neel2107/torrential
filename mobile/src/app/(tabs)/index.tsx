import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minutesLeft } from '@web/lib/format';
import { episodeCode, episodeName } from '@web/titles/words';
import type { Continue } from '@web/wire';

import { useHome } from '@/engine/queries';
import { Art } from '@/ui/Art';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineAvatar } from '@/ui/EngineAvatar';
import { EngineProblem } from '@/ui/EngineProblem';
import { Fab } from '@/ui/Fab';
import { Icon, icons } from '@/ui/Icon';
import { Logo } from '@/ui/Logo';
import { Mark } from '@/ui/Mark';
import { Meter } from '@/ui/Meter';
import { PosterGrid } from '@/ui/PosterGrid';
import { rise } from '@/ui/rise';
import { Skeleton } from '@/ui/Skeleton';
import { TAB_BAR_HEIGHT } from '@/ui/TabBar';
import { Tap } from '@/ui/Tap';
import { TopBar, useTopInset } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { color, radius, space, type } from '@/theme';

export default function Home() {
  const home = useHome();
  const insets = useSafeAreaInsets();
  const top = useTopInset(false);
  const onScroll = useChromeScroll();
  const { docked } = useChrome();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await home.refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: top + space.md,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 96 + docked,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={color.soft}
            colors={[color.actionInk]}
            progressBackgroundColor={color.action}
            progressViewOffset={top}
          />
        }
      >
        {home.isPending ? (
          <Loading />
        ) : home.isError ? (
          <EngineProblem error={home.error} onRetry={() => home.refetch()} />
        ) : home.data.continue.length === 0 && home.data.saved.length === 0 ? (
          <Empty />
        ) : (
          <>
            {home.data.continue.length > 0 ? <ContinueCarousel items={home.data.continue} /> : null}
            {home.data.saved.length > 0 ? (
              <Animated.View entering={rise(2)} style={styles.section}>
                <SectionTitle>Saved</SectionTitle>
                <PosterGrid titles={home.data.saved} />
              </Animated.View>
            ) : null}
          </>
        )}
      </Animated.ScrollView>
      <TopBar
        left={<EngineAvatar />}
        title={<Mark size={30} />}
        right={
          <Tap
            haptic
            shrink={0.9}
            onPress={() => router.push('/tv')}
            accessibilityLabel="Play on TV"
            style={styles.iconButton}
          >
            <Icon name={icons.cast} size={22} tint={color.ink} />
          </Tap>
        }
      />
      <Fab icon={icons.add} label="Add a magnet link" onPress={() => router.push('/add')} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={[type.title, styles.sectionTitle]} accessibilityRole="header">
      {children}
    </Text>
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

function ContinueCarousel({ items }: { items: Continue[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = items.length > 1 ? width - space.page * 2 - 28 : width - space.page * 2;
  const [page, setPage] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + space.md));
    if (next !== page) setPage(next);
  };

  return (
    <Animated.View entering={rise(0)} style={styles.carousel}>
      <SectionTitle>Continue watching</SectionTitle>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + space.md}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: space.page, gap: space.md }}
      >
        {items.map((item, index) => (
          <ContinueCard key={item.video} item={item} width={cardWidth} index={index} />
        ))}
      </Animated.ScrollView>
      {items.length > 1 ? (
        <View style={styles.dots} accessible={false}>
          {items.map((item, index) => (
            <View key={item.video} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function ContinueCard({ item, width, index }: { item: Continue; width: number; index: number }) {
  const progress = progressOf(item);
  const height = Math.round((width * 9) / 16);
  const still = item.episode?.thumbnail;

  return (
    <Animated.View entering={rise(index)} style={{ width }}>
      <Tap
        shrink={0.98}
        onPress={() => play(item)}
        onLongPress={() => router.push({ pathname: '/title/[id]', params: { id: item.title.id } })}
        accessibilityLabel={`${item.title.name}, ${subtitleOf(item)}, ${remainingOf(item)}`}
        accessibilityHint="Plays it. Long press opens its page."
      >
        <View style={[styles.still, { height }]}>
          <Art
            id={item.title.id}
            kind={still ? 'thumbnail' : 'background'}
            season={still ? item.episode!.season : undefined}
            episode={still ? item.episode!.episode : undefined}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(10,9,7,0.85)']}
            locations={[0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stillBody}>
            <Logo id={item.title.id} name={item.title.name} style={styles.logo} />
            <View style={styles.playPill}>
              <Icon name={icons.play} size={14} tint={color.actionInk} filled />
              <Text style={styles.playPillText}>{progress ? 'Resume' : 'Play'}</Text>
            </View>
          </View>
          {progress !== null ? (
            <View style={styles.edgeMeter}>
              <Meter fraction={progress} />
            </View>
          ) : null}
        </View>
      </Tap>
      <Tap
        shrink={1}
        onPress={() => router.push({ pathname: '/title/[id]', params: { id: item.title.id } })}
        accessibilityLabel={`Open ${item.title.name}`}
        style={styles.cardText}
      >
        <View style={{ flex: 1 }}>
          <Text style={type.headline} numberOfLines={1}>
            {item.title.name}
          </Text>
          <Text style={type.label} numberOfLines={1}>
            {subtitleOf(item)}
          </Text>
        </View>
        <Text style={[type.numeric, { color: color.pencil }]}>{remainingOf(item)}</Text>
      </Tap>
    </Animated.View>
  );
}

function Empty() {
  return (
    <Animated.View entering={rise(0)} style={styles.empty}>
      <Icon name={icons.film} size={40} tint={color.pencil} />
      <Text style={[type.title, { textAlign: 'center' }]}>Nothing here yet</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>
        Find a film or a show and it starts playing in seconds, while it downloads.
      </Text>
      <Button
        label="Search"
        icon={icons.search}
        onPress={() => router.navigate('/search')}
        style={{ marginTop: space.sm }}
      />
    </Animated.View>
  );
}

function Loading() {
  const { width } = useWindowDimensions();
  const cardWidth = width - space.page * 2 - 28;
  return (
    <View
      style={{ paddingHorizontal: space.page, gap: space.lg }}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <Skeleton style={{ width: 200, height: 24, borderRadius: radius.sm }} />
      <Skeleton style={{ width: cardWidth, height: Math.round((cardWidth * 9) / 16), borderRadius: radius.lg }} />
      <Skeleton style={{ width: 160, height: 16, borderRadius: radius.sm }} />
      <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
        <Skeleton style={{ flex: 1, aspectRatio: 2 / 3, borderRadius: radius.md }} />
        <Skeleton style={{ flex: 1, aspectRatio: 2 / 3, borderRadius: radius.md }} />
        <Skeleton style={{ flex: 1, aspectRatio: 2 / 3, borderRadius: radius.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  carousel: { gap: space.md },
  section: { marginTop: space.xxl, gap: space.md },
  sectionTitle: { paddingHorizontal: space.page },
  still: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.raised, justifyContent: 'flex-end' },
  stillBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  logo: { flex: 1, height: 48, maxWidth: '62%' },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
  },
  playPillText: { ...type.callout, color: color.actionInk, fontSize: 14 },
  edgeMeter: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  cardText: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md, paddingHorizontal: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.rule },
  dotActive: { width: 18, backgroundColor: color.soft },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 96 },
});
