import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  LinearTransition,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { day, minutes, minutesLeft } from '@web/lib/format';
import { videoOf } from '@web/lib/video';
import { episodeCode, episodeName, findEpisode, seasonName } from '@web/titles/words';
import type { EpisodeInfo, TitlePage as Page, Watched } from '@web/wire';

import { authHeaders, url } from '@/engine/client';
import { useSaveTitle, useTitle } from '@/engine/queries';
import { useLink } from '@/engine/session';
import { useSources } from '@/player/sources';
import { SourcesSheet } from '@/player/SourcesSheet';
import { Art } from '@/ui/Art';
import { Burst, type BurstHandle } from '@/ui/Burst';
import { Button } from '@/ui/Button';
import { CastBar } from '@/ui/CastBar';
import { EngineProblem } from '@/ui/EngineProblem';
import { HeroTarget, useHeroPage } from '@/ui/hero';
import { bannerHeight as bannerHeightOf, OVERLAP, POSTER, RING, RISE } from '@/ui/titleGeometry';
import { Icon, icons } from '@/ui/Icon';
import { Meter } from '@/ui/Meter';
import { rise } from '@/ui/rise';
import { Skeleton } from '@/ui/Skeleton';
import { TabStrip, usePagerPosition } from '@/ui/Pager';
import { Tap } from '@/ui/Tap';
import { color, font, motion, radius, space, type } from '@/theme';

export default function Title() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const title = useTitle(id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const bannerHeight = bannerHeightOf(width);
  const [refreshing, setRefreshing] = useState(false);
  const [docked, setDocked] = useState(0);
  const hero = useHeroPage(id);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const banner = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [{ translateY: y < 0 ? y / 2 : -y * 0.5 }, { scale: y < 0 ? 1 + -y / bannerHeight : 1 }],
    };
  });
  const headerName = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [bannerHeight + 40, bannerHeight + 90], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [bannerHeight + 40, bannerHeight + 90], [8, 0], Extrapolation.CLAMP) },
    ],
  }));
  const headerShade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [bannerHeight - 120, bannerHeight - 40], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <hero.Provider value={hero.slot}>
      <Animated.View style={[styles.screen, hero.style]}>
        <Animated.View style={[styles.banner, { height: bannerHeight }, banner]}>
          <Art id={id} kind="background" style={StyleSheet.absoluteFill} name={title.data?.name} />
          <LinearGradient
            colors={['rgba(20,18,15,0.35)', 'transparent', 'rgba(20,18,15,0.9)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: bannerHeight - OVERLAP,
            paddingBottom: insets.bottom + space.xxl + docked,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await title.refetch();
                setRefreshing(false);
              }}
              tintColor={color.soft}
              colors={[color.actionInk]}
              progressBackgroundColor={color.action}
              progressViewOffset={insets.top + 40}
            />
          }
        >
          {title.isPending ? (
            <Loading id={id} />
          ) : title.isError ? (
            <View style={styles.sheet}>
              <EngineProblem error={title.error} onRetry={() => title.refetch()} />
            </View>
          ) : (
            <Body page={title.data} />
          )}
        </Animated.ScrollView>

        <View style={[styles.header, { paddingTop: insets.top }]} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.headerShade, headerShade]} pointerEvents="none" />
          <Tap shrink={0.88} haptic onPress={() => router.back()} accessibilityLabel="Back" style={styles.round}>
            <Icon name={icons.back} size={22} tint={color.ink} />
          </Tap>
          <Animated.View style={[styles.headerTitle, headerName]} pointerEvents="none">
            <Text style={type.headline} numberOfLines={1}>
              {title.data?.name}
            </Text>
            {title.data?.year ? <Text style={type.caption}>{title.data.year}</Text> : null}
          </Animated.View>
          <Tap
            shrink={0.88}
            haptic
            onPress={() =>
              router.push({
                pathname: '/tv',
                params: title.data?.play_target ? { video: title.data.play_target.video } : {},
              })
            }
            accessibilityLabel="Play on TV"
            style={styles.round}
          >
            <Icon name={icons.cast} size={20} tint={color.ink} />
          </Tap>
        </View>
        <CastBar bottom={insets.bottom + space.sm} onHeight={setDocked} />
      </Animated.View>
    </hero.Provider>
  );
}

function facts(page: Page): string[] {
  return [
    page.year ? String(page.year) : null,
    page.kind === 'series'
      ? `${page.seasons.filter((s) => s.number > 0).length} seasons`
      : page.runtime_min
        ? minutes(page.runtime_min)
        : null,
    page.genres.slice(0, 2).join(', ') || null,
  ].filter((fact): fact is string => Boolean(fact));
}

function Body({ page }: { page: Page }) {
  const target = page.play_target ?? page.next;
  useSources(target?.video ?? null);
  const targetEpisode = target ? findEpisode(page, target.video) : null;
  const watched = useMemo(() => new Map(page.watched.map((w) => [w.video, w])), [page.watched]);
  const resume = target?.resume_at ?? null;
  const targetWatched = target ? watched.get(target.video) : undefined;
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const playLabel = resume ? 'Resume' : 'Play';
  const playDetail = targetEpisode
    ? `${episodeCode(targetEpisode)} · ${episodeName(targetEpisode)}`
    : resume && targetWatched?.duration
      ? minutesLeft(resume, targetWatched.duration)
      : null;

  return (
    <View style={styles.sheet}>
      <View style={styles.identity}>
        <PosterSlot id={page.id} name={page.name} />
        <SaveButton id={page.id} saved={page.saved} />
      </View>

      <Animated.View entering={rise(1)} style={styles.block}>
        <Text style={type.display} accessibilityRole="header">
          {page.name}
        </Text>
        <View style={styles.facts}>
          {page.rating ? (
            <View style={styles.rating}>
              <Icon name={icons.star} size={13} tint={color.action} filled />
              <Text style={[type.numeric, { color: color.ink }]}>{page.rating.toFixed(1)}</Text>
            </View>
          ) : null}
          <Text style={type.label}>{facts(page).join('  ·  ')}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={rise(2)} style={styles.actions}>
        <Button
          label={playLabel}
          icon={icons.play}
          onPress={() => target && router.push({ pathname: '/play', params: { video: target.video } })}
          disabled={!target}
          style={{ flex: 1 }}
        />
        <Tap
          haptic
          shrink={0.92}
          onPress={() => router.push({ pathname: '/tv', params: target ? { video: target.video } : {} })}
          accessibilityLabel="Play on TV"
          style={styles.squareButton}
        >
          <Icon name={icons.cast} size={20} tint={color.ink} />
        </Tap>
      </Animated.View>
      {playDetail ? (
        <Animated.View entering={rise(3)} style={styles.playDetail}>
          {resume && targetWatched?.duration ? <Meter fraction={resume / targetWatched.duration} /> : null}
          <Text style={type.caption}>{playDetail}</Text>
        </Animated.View>
      ) : null}

      {target ? (
        <Animated.View entering={rise(3)}>
          <Tap
            shrink={1}
            highlight
            onPress={() => setSourcesOpen(true)}
            accessibilityLabel="Choose a source"
            style={styles.sourcesRow}
          >
            <Icon name={icons.episodes} size={18} tint={color.soft} />
            <Text style={[type.label, { flex: 1, color: color.ink }]}>Choose a source</Text>
            <Icon name={icons.chevron} size={18} tint={color.pencil} />
          </Tap>
        </Animated.View>
      ) : null}

      {page.synopsis ? (
        <Animated.View entering={rise(3)}>
          <Synopsis text={page.synopsis} />
        </Animated.View>
      ) : null}

      {page.cast.length > 0 ? (
        <Animated.Text entering={rise(4)} style={[type.caption, styles.block]} numberOfLines={2}>
          <Text style={{ color: color.soft, fontFamily: font.medium }}>Starring </Text>
          {page.cast.slice(0, 5).join(', ')}
        </Animated.Text>
      ) : null}

      {page.kind === 'series' ? <Episodes page={page} watched={watched} current={target?.video ?? null} /> : null}

      {sourcesOpen && target ? (
        <SourcesSheet
          video={target.video}
          label={targetEpisode ? `${episodeCode(targetEpisode)} · ${episodeName(targetEpisode)}` : page.name}
          onClose={() => setSourcesOpen(false)}
        />
      ) : null}
    </View>
  );
}

function SaveButton({ id, saved }: { id: string; saved: boolean }) {
  const save = useSaveTitle(id);
  const burst = useRef<BurstHandle>(null);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Tap
      shrink={0.94}
      onPress={() => {
        Haptics.impactAsync(saved ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
        pop.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, motion.pop));
        if (!saved) burst.current?.fire();
        save.mutate(!saved);
      }}
      accessibilityLabel={saved ? 'Saved. Remove from saved' : 'Save'}
      accessibilityState={{ selected: saved }}
      style={[styles.save, saved ? styles.saveOn : styles.saveOff]}
    >
      <View>
        <Burst ref={burst} size={34} />
        <Animated.View style={style}>
          <Icon name={icons.save} size={17} tint={saved ? color.actionInk : color.ink} filled={saved} />
        </Animated.View>
      </View>
      <Animated.Text
        layout={LinearTransition.duration(motion.quick)}
        style={[styles.saveText, { color: saved ? color.actionInk : color.ink }]}
      >
        {saved ? 'Saved' : 'Save'}
      </Animated.Text>
    </Tap>
  );
}

function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 170;
  return (
    <Tap
      shrink={1}
      onPress={() => long && setOpen((o) => !o)}
      accessibilityLabel={text}
      accessibilityHint={long ? 'Shows all of it' : undefined}
      style={styles.block}
    >
      <Animated.Text
        layout={LinearTransition.duration(motion.standard)}
        style={type.body}
        numberOfLines={open ? undefined : 3}
      >
        {text}
      </Animated.Text>
      {long && !open ? <Text style={[type.label, { color: color.ink, marginTop: 2 }]}>More</Text> : null}
    </Tap>
  );
}

function Episodes({ page, watched, current }: { page: Page; watched: Map<string, Watched>; current: string | null }) {
  const { width } = useWindowDimensions();
  const seasons = page.seasons.filter((s) => s.episodes.length > 0);
  const currentSeason = current ? findEpisode(page, current)?.season : undefined;
  const [season, setSeason] = useState(
    () => currentSeason ?? seasons.find((s) => s.number > 0)?.number ?? seasons[0]?.number ?? 1,
  );
  const at = Math.max(
    0,
    seasons.findIndex((s) => s.number === season),
  );
  const position = usePagerPosition(at);
  const link = useLink();
  const drag = useSharedValue(0);

  const show = (next: number) => {
    Haptics.selectionAsync();
    setSeason(seasons[next].number);
  };
  const last = seasons.length - 1;

  useEffect(() => {
    const near = [seasons[at - 1], seasons[at + 1]].flatMap((s) => s?.episodes ?? []);
    const stills = near
      .filter((episode) => episode.thumbnail)
      .map((episode) =>
        url(link, '/api/title/art', {
          id: page.id,
          kind: 'thumbnail',
          season: episode.season,
          episode: episode.episode,
        }),
      );
    if (stills.length) Image.prefetch(stills, { cachePolicy: 'memory-disk', headers: authHeaders(link) });
  }, [at, link, page.id, seasons]);

  useEffect(() => {
    if (currentSeason === undefined) return;
    const next = seasons.findIndex((s) => s.number === currentSeason);
    if (next >= 0) position.value = next;
    setSeason(currentSeason);
  }, [currentSeason]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const room = (event.translationX < 0 ? at < last : at > 0) ? 1 : 0.25;
      drag.value = event.translationX * room;
      position.value = Math.min(last, Math.max(0, at - (drag.value / width) * room));
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > width * 0.25 || Math.abs(event.velocityX) > 600;
      const next = at + (event.translationX < 0 ? 1 : -1);
      if (far && next >= 0 && next <= last) {
        drag.value = Math.sign(event.translationX) * -width * 0.15;
        position.value = withTiming(next, GLIDE);
        runOnJS(show)(next);
      } else {
        position.value = withTiming(at, GLIDE);
      }
      drag.value = withSpring(0, { damping: 22, stiffness: 220 });
    });

  const carried = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value * 0.5 }],
    opacity: 1 - Math.min(0.5, Math.abs(drag.value) / width),
  }));

  const episodes = seasons[at]?.episodes ?? [];

  return (
    <View style={{ marginTop: space.lg }}>
      {seasons.length > 1 ? (
        <TabStrip
          labels={seasons.map((s) => seasonName(s.number))}
          index={at}
          position={position}
          onChange={(next) => setSeason(seasons[next].number)}
          scroll
          glide
          style={styles.seasons}
        />
      ) : (
        <View style={styles.rule} />
      )}
      <GestureDetector gesture={swipe}>
        <Animated.View style={carried}>
          {episodes.map((episode, index) => (
            <EpisodeRow
              key={episode.episode}
              page={page}
              episode={episode}
              watched={watched.get(videoOf(page.id, episode))}
              index={index}
              current={current === videoOf(page.id, episode)}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const GLIDE = { duration: 260, easing: motion.out };

function EpisodeRow({
  page,
  episode,
  watched,
  index,
  current,
}: {
  page: Page;
  episode: EpisodeInfo;
  watched?: Watched;
  index: number;
  current: boolean;
}) {
  const video = videoOf(page.id, episode);
  const progress = watched?.finished ? 1 : watched?.duration ? watched.position / watched.duration : null;
  const aired = episode.has_aired;

  return (
    <Animated.View entering={rise(index)}>
      <Tap
        shrink={1}
        highlight
        disabled={!aired}
        onPress={() => router.push({ pathname: '/play', params: { video } })}
        accessibilityLabel={`${episodeCode(episode)}, ${episodeName(episode)}${aired ? '' : ', not out yet'}`}
        style={[styles.episode, !aired && { opacity: 0.45 }]}
      >
        <View style={styles.still}>
          <Text style={styles.stillNumber}>{episode.episode}</Text>
          {episode.thumbnail ? (
            <Art
              id={page.id}
              kind="thumbnail"
              season={episode.season}
              episode={episode.episode}
              style={StyleSheet.absoluteFill}
              placeholder={false}
            />
          ) : null}
          <View style={styles.stillPlay}>
            <Icon name={icons.play} size={14} tint={color.ink} filled />
          </View>
          {progress !== null ? (
            <View style={styles.stillMeter}>
              <Meter fraction={progress} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.callout, current && { color: color.action }]} numberOfLines={2}>
            {episode.episode}. {episodeName(episode)}
          </Text>
          <Text style={type.caption}>
            {[episode.aired ? day(episode.aired) : null, watched?.finished ? 'Watched' : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {episode.overview ? (
            <Text style={[type.caption, { color: color.soft }]} numberOfLines={2}>
              {episode.overview}
            </Text>
          ) : null}
        </View>
      </Tap>
    </Animated.View>
  );
}

function PosterSlot({ id, name }: { id: string; name?: string }) {
  return (
    <View style={styles.posterWrap}>
      <Link.AppleZoomTarget>
        <HeroTarget id={id}>
          <Art id={id} kind="poster" name={name} style={styles.poster} fade={false} />
        </HeroTarget>
      </Link.AppleZoomTarget>
    </View>
  );
}

function Loading({ id }: { id: string }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.identity}>
        <PosterSlot id={id} />
      </View>
      <Skeleton style={{ height: 32, width: '70%', borderRadius: radius.sm, marginTop: space.lg }} />
      <Skeleton style={{ height: 16, width: '45%', borderRadius: radius.sm, marginTop: space.md }} />
      <Skeleton style={{ height: 48, borderRadius: radius.pill, marginTop: space.xl }} />
      <Skeleton style={{ height: 72, borderRadius: radius.sm, marginTop: space.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: color.raised, overflow: 'hidden' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  headerShade: {
    backgroundColor: 'rgba(20,18,15,0.96)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.rule,
  },
  headerTitle: { flex: 1 },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,18,15,0.6)',
  },
  sheet: { backgroundColor: color.paper, paddingHorizontal: space.page, minHeight: 600 },
  identity: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -RISE },
  posterWrap: {
    borderRadius: radius.md + 3,
    borderWidth: RING,
    borderColor: color.paper,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  poster: { ...POSTER, borderRadius: radius.md },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    marginBottom: space.xs,
  },
  saveOff: { borderWidth: 1, borderColor: color.rule },
  saveOn: { backgroundColor: color.ink },
  saveText: { fontFamily: font.bold, fontSize: 15 },
  block: { marginTop: space.lg },
  facts: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm, flexWrap: 'wrap' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  squareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.rule,
  },
  playDetail: { gap: space.sm, marginTop: space.md },
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    marginHorizontal: -space.sm,
    paddingHorizontal: space.sm,
    minHeight: 44,
    borderRadius: radius.md,
  },
  seasons: { marginHorizontal: -space.page },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.rule, marginHorizontal: -space.page },
  episode: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    marginHorizontal: -space.page,
    paddingHorizontal: space.page,
  },
  still: { width: 136, height: 77, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.raised },
  stillNumber: {
    position: 'absolute',
    right: 10,
    bottom: 2,
    fontFamily: font.bold,
    fontSize: 40,
    letterSpacing: -1.5,
    color: color.lifted,
  },
  stillPlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.scrim,
  },
  stillMeter: { position: 'absolute', left: 6, right: 6, bottom: 6 },
});
