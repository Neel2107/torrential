import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';

import type { Continue } from '@web/wire';

import { useHome } from '@/engine/queries';
import { Art } from '@/ui/Art';
import { useChrome, useChromeScroll } from '@/ui/chrome';
import { EngineAvatar } from '@/ui/EngineAvatar';
import { EngineProblem } from '@/ui/EngineProblem';
import { ADD_IN_TOP_BAR, FAB_ROOM, Fab } from '@/ui/Fab';
import { Icon, icons } from '@/ui/Icon';
import { Logo } from '@/ui/Logo';
import { PullMark, usePullToRefresh } from '@/ui/pull';
import { Meter } from '@/ui/Meter';
import { PosterGrid } from '@/ui/PosterGrid';
import { rise } from '@/ui/rise';
import { Skeleton } from '@/ui/Skeleton';
import { Stage } from '@/ui/stage';
import { Tap } from '@/ui/Tap';
import { TitleTap } from '@/ui/TitleTap';
import { NewEpisodes } from '@/ui/NewEpisodes';
import { PopularRow } from '@/ui/Popular';
import { Actions, TopBar, useTopInset } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { progressOf, remainingOf, resume, subtitleOf } from '@/ui/watching';
import { color, radius, space, stage, type } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

export default function Home() {
  const home = useHome();
  const top = useTopInset(false);
  const offset = useSharedValue(0);
  const refetch = home.refetch;

  const pull = usePullToRefresh(
    offset,
    useCallback(() => refetch(), [refetch]),
  );

  const onScroll = useChromeScroll({ offset, fromBounce: pull.fromBounce, endBounce: pull.endBounce });
  const { bottom } = useChrome();

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={pull.gesture}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          overScrollMode="never"
          style={pull.feed}
          contentContainerStyle={{
            paddingTop: top + space.md,
            paddingBottom: bottom + FAB_ROOM,
          }}
        >
          {home.isPending ? (
            <Loading />
          ) : home.isError ? (
            <EngineProblem error={home.error} onRetry={() => home.refetch()} />
          ) : home.data.continue.length === 0 && home.data.saved.length === 0 ? (
            <>
              <Empty />
              <PopularRow kind="film" title="Popular films" skip={NONE} index={1} />
              <PopularRow kind="series" title="Popular shows" skip={NONE} index={2} />
            </>
          ) : (
            <>
              {home.data.continue.length > 0 ? <ContinueCarousel items={home.data.continue} /> : null}
              <NewEpisodes saved={home.data.saved} index={1} />
              {home.data.saved.length > 0 ? (
                <Animated.View entering={rise(2)} style={styles.section}>
                  <SectionTitle>Saved</SectionTitle>
                  <PosterGrid titles={home.data.saved} />
                </Animated.View>
              ) : null}
            </>
          )}
        </Animated.ScrollView>
      </GestureDetector>
      <TopBar
        left={<EngineAvatar />}
        mark={<PullMark size={30} />}
        right={
          <Actions
            actions={[
              { icon: icons.cast, label: 'Play on TV', onPress: () => router.push('/tv') },
              ...(ADD_IN_TOP_BAR
                ? [{ icon: icons.add, label: 'Add a magnet link', onPress: () => router.push('/add') }]
                : []),
            ]}
          />
        }
      />
      <Fab icon={icons.add} label="Add a magnet link" onPress={() => router.push('/add')} />
    </View>
  );
}

const NONE: ReadonlySet<string> = new Set();

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={[type.title, styles.sectionTitle]} accessibilityRole="header">
      {children}
    </Text>
  );
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
        onPress={() => resume(item)}
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
          <Stage value>
            <View style={styles.stillBody}>
              <Logo id={item.title.id} name={item.title.name} style={styles.logo} />
              <View style={styles.playPill}>
                <Icon name={icons.play} size={14} tint={stage.actionInk} filled />
                <Text style={styles.playPillText}>{progress ? 'Resume' : 'Play'}</Text>
              </View>
            </View>
          </Stage>
          {progress !== null ? (
            <View style={styles.edgeMeter}>
              <Meter fraction={progress} />
            </View>
          ) : null}
        </View>
      </Tap>
      <TitleTap id={item.title.id} shrink={1} accessibilityLabel={`Open ${item.title.name}`} style={styles.cardText}>
        <View style={{ flex: 1 }}>
          <Text style={type.headline} numberOfLines={1}>
            {item.title.name}
          </Text>
          <Text style={type.label} numberOfLines={1}>
            {subtitleOf(item)}
          </Text>
        </View>
        <Text style={[type.numeric, { color: color.pencil }]}>{remainingOf(item)}</Text>
      </TitleTap>
    </Animated.View>
  );
}

function Empty() {
  return (
    <EmptyState
      icon={icons.film}
      title="Your library is empty"
      body="Find a film or a show and it starts playing in seconds, while it downloads."
    >
      <Button label="Search" icon={icons.search} onPress={() => router.navigate('/search')} />
    </EmptyState>
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
    backgroundColor: stage.ink,
  },
  playPillText: { ...type.callout, color: stage.actionInk, fontSize: 14 },
  edgeMeter: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  cardText: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md, paddingHorizontal: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.rule },
  dotActive: { width: 18, backgroundColor: color.soft },
  empty: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xxl, paddingTop: 96 },
});
