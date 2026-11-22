import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { day, minutes, minutesLeft, sentence } from '@web/lib/format';
import { videoOf } from '@web/lib/video';
import { episodeCode, episodeName, findEpisode, seasonName } from '@web/titles/words';
import type { EpisodeInfo, TitlePage as Page, Watched } from '@web/wire';

import { authHeaders, url } from '@/engine/client';
import { useDownload, useHeldProgress, useHeldState, type Fetching } from '@/engine/download';
import { useSaveTitle, useTitle } from '@/engine/queries';
import { useLink, useSession } from '@/engine/session';
import { useSources } from '@/player/sources';
import { SourcesSheet } from '@/player/SourcesSheet';
import type { Label } from '@/offline/saved';
import { Art } from '@/ui/Art';
import { LoadingMark } from '@/ui/Bands';
import { Burst, type BurstHandle } from '@/ui/Burst';
import { Button } from '@/ui/Button';
import { CastBar } from '@/ui/CastBar';
import { EngineProblem } from '@/ui/EngineProblem';
import { HeroTarget, useHeroPage, useLanded } from '@/ui/hero';
import { bannerHeight as bannerHeightOf, OVERLAP, POSTER, RING, RISE } from '@/ui/titleGeometry';
import { Icon, icons } from '@/ui/Icon';
import { Meter } from '@/ui/Meter';
import { NavRow } from '@/ui/Row';
import { ProgressRing } from '@/ui/ProgressRing';
import { rise } from '@/ui/rise';
import { Skeleton } from '@/ui/Skeleton';
import { TabStrip, usePagerPosition } from '@/ui/Pager';
import { TitleFacts } from '@/ui/TitleFacts';
import { Tap } from '@/ui/Tap';
import { leave } from '@/ui/leave';
import { alpha, color, font, motion, radius, scheme, space, type } from '@/theme';
import { appear, reflow } from '@/ui/presets';

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
    scrollY.set(event.contentOffset.y);
  });

  const banner = useAnimatedStyle(() => {
    const y = scrollY.get();

    return {
      transform: [{ translateY: y < 0 ? y / 2 : -y * 0.5 }, { scale: y < 0 ? 1 + -y / bannerHeight : 1 }],
    };
  });

  const headerName = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [bannerHeight + 40, bannerHeight + 90], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.get(), [bannerHeight + 40, bannerHeight + 90], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  const headerShade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [bannerHeight - 120, bannerHeight - 40], [0, 1], Extrapolation.CLAMP),
  }));

  const navigation = useNavigation();
  const [overArt, setOverArt] = useState(true);
  useAnimatedReaction(
    () => scrollY.get() < bannerHeight - 80,
    (now, before) => {
      if (scheme === 'light' && now !== before) scheduleOnRN(setOverArt, now);
    },
  );
  useEffect(() => {
    if (scheme === 'light') navigation.setOptions({ statusBarStyle: overArt ? 'light' : 'dark' });
  }, [navigation, overArt]);

  return (
    <hero.Provider value={hero.slot}>
      <Animated.View style={[styles.screen, hero.style]}>
        <Animated.View style={[styles.banner, { height: bannerHeight }, banner]}>
          <Art id={id} kind="background" style={StyleSheet.absoluteFill} name={title.data?.name} />
          <LinearGradient
            colors={[alpha(color.paper, 0.35), 'transparent', alpha(color.paper, 0.9)]}
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
          <Tap shrink={0.88} haptic onPress={leave} accessibilityLabel="Back" style={styles.round}>
            <Icon name={icons.back} size={22} tint={color.ink} />
          </Tap>
          <Animated.View style={[styles.headerTitle, headerName]} pointerEvents="none">
            <Text style={type.headline} numberOfLines={1}>
              {title.data?.name}
            </Text>
            {title.data?.year ? <Text style={type.caption}>{title.data.year}</Text> : null}
          </Animated.View>
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
  const landed = useLanded(page.id);
  const enter = (index: number) => (landed ? rise(index) : undefined);
  const target = page.play_target ?? page.next;
  useSources(landed ? (target?.video ?? null) : null);
  const targetEpisode = target ? findEpisode(page, target.video) : null;
  const watched = useMemo(() => new Map(page.watched.map((w) => [w.video, w])), [page.watched]);
  const resume = target?.resume_at ?? null;
  const targetWatched = target ? watched.get(target.video) : undefined;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [fetching, setFetching] = useState<Fetching>({ state: 'idle' });
  const { session } = useSession();
  const onComputer = session.state === 'paired' && session.engine.kind !== 'phone';

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

      <Animated.View entering={enter(1)} style={styles.block}>
        <Text style={type.display} accessibilityRole="header">
          {page.name}
        </Text>
        <TitleFacts rating={page.rating} facts={facts(page)} size="page" />
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.actions}>
        <Button
          label={playLabel}
          icon={icons.play}
          onPress={() => target && router.push({ pathname: '/play', params: { video: target.video } })}
          disabled={!target}
          style={{ flex: 1 }}
        />
        <DownloadButton
          video={target?.video ?? null}
          label={{
            title: page.name,
            tags: targetEpisode ? episodeCode(targetEpisode) : page.year ? String(page.year) : '',
            poster: page.id,
          }}
          sheetLabel={targetEpisode ? `${episodeCode(targetEpisode)} · ${episodeName(targetEpisode)}` : page.name}
          onState={setFetching}
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
      {fetching.state === 'started' || fetching.state === 'failed' ? (
        <Animated.View entering={appear} style={styles.fetched}>
          {fetching.state === 'failed' ? (
            <Text style={[type.caption, { color: color.error }]}>{sentence(fetching.message)}</Text>
          ) : (
            <Tap
              shrink={0.97}
              onPress={() => router.navigate('/downloads')}
              accessibilityLabel={`${onComputer ? 'Downloading. It comes to this phone when it finishes.' : 'Downloading to this phone.'} Open Downloads`}
              style={styles.fetchedRow}
            >
              <Text style={[type.caption, { flex: 1 }]}>
                {onComputer ? 'Downloading. It comes to this phone when it finishes.' : 'Downloading to this phone.'}
              </Text>
              <Text style={[type.caption, { color: color.action, fontFamily: font.medium }]}>Downloads</Text>
              <Icon name={icons.chevron} size={14} tint={color.action} />
            </Tap>
          )}
        </Animated.View>
      ) : null}
      {playDetail ? (
        <Animated.View entering={enter(3)} style={styles.playDetail}>
          {resume && targetWatched?.duration ? <Meter fraction={resume / targetWatched.duration} /> : null}
          <Text style={type.caption}>{playDetail}</Text>
        </Animated.View>
      ) : null}

      {target ? (
        <Animated.View entering={enter(3)} style={{ marginTop: space.sm }}>
          <NavRow
            label="Choose a source"
            leading={<Icon name={icons.episodes} size={18} tint={color.soft} />}
            onPress={() => setSourcesOpen(true)}
          />
        </Animated.View>
      ) : null}

      {page.synopsis && landed ? (
        <Animated.View entering={enter(3)}>
          <Synopsis text={page.synopsis} />
        </Animated.View>
      ) : null}

      {page.cast.length > 0 && landed ? (
        <Animated.Text entering={enter(4)} style={[type.caption, styles.block]} numberOfLines={2}>
          <Text style={{ color: color.soft, fontFamily: font.medium }}>Starring </Text>
          {page.cast.slice(0, 5).join(', ')}
        </Animated.Text>
      ) : null}

      {page.kind === 'series' && landed ? (
        <Episodes page={page} watched={watched} current={target?.video ?? null} />
      ) : null}

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

function DownloadButton({
  video,
  label,
  sheetLabel,
  onState,
}: {
  video: string | null;
  label: Label;
  sheetLabel: string;
  onState: (fetching: Fetching) => void;
}) {
  const { fetching: asked, start, onComputer } = useDownload(video, label);
  const held = useHeldProgress(video, asked.state === 'started' ? asked.job : undefined);
  const [choosing, setChoosing] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const job = asked.state === 'started' ? asked.job : null;
  useEffect(() => {
    if (job && held.state !== 'none') setSeen(job);
  }, [job, held.state]);
  const gone = job !== null && seen === job && held.state === 'none';
  const shown: Fetching = gone ? { state: 'idle' } : asked;

  const state =
    asked.state === 'finding'
      ? 'finding'
      : held.state === 'done'
        ? 'done'
        : held.state === 'downloading' || (asked.state === 'started' && !gone)
          ? 'downloading'
          : 'idle';

  useEffect(() => onState(shown), [shown.state, onState]);

  return (
    <>
      <Tap
        haptic
        shrink={0.92}
        disabled={!video || state !== 'idle'}
        onPress={() => setChoosing(true)}
        accessibilityLabel={
          state === 'done'
            ? onComputer
              ? 'Downloaded on your computer'
              : 'Downloaded to this phone'
            : state === 'downloading'
              ? `Downloading, ${Math.round(held.fraction * 100)}%. Follow it in Downloads.`
              : 'Download'
        }
        accessibilityHint={state === 'idle' ? 'Choose a source to download.' : undefined}
        accessibilityState={{ busy: state === 'finding' }}
        style={[
          styles.squareButton,
          state === 'downloading' && styles.ringed,
          state === 'done' && { borderColor: color.action },
        ]}
      >
        {state === 'downloading' ? <ProgressRing size={48} fraction={held.fraction} /> : null}
        {state === 'finding' ? (
          <LoadingMark size={20} label="Finding a source" />
        ) : (
          <Icon
            name={state === 'done' ? icons.check : icons.downloads}
            size={20}
            tint={state === 'idle' ? color.ink : color.action}
          />
        )}
      </Tap>
      {choosing && video ? (
        <SourcesSheet
          video={video}
          label={sheetLabel}
          heading="Download a source"
          onPick={(release) => start(release.id)}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </>
  );
}

function SaveButton({ id, saved }: { id: string; saved: boolean }) {
  const save = useSaveTitle(id);
  const burst = useRef<BurstHandle>(null);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Tap
      shrink={0.94}
      onPress={() => {
        Haptics.impactAsync(saved ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
        pop.set(withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, motion.pop)));

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
      <Animated.Text layout={reflow} style={[styles.saveText, { color: saved ? color.actionInk : color.ink }]}>
        {saved ? 'Saved' : 'Save'}
      </Animated.Text>
    </Tap>
  );
}

function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(0);
  const long = lines > SYNOPSIS_LINES;

  return (
    <Tap
      shrink={1}
      onPress={() => long && setOpen((o) => !o)}
      accessibilityLabel={text}
      accessibilityHint={long ? 'Shows all of it' : undefined}
      style={styles.block}
    >
      <Text
        style={[type.body, styles.measure]}
        onTextLayout={(event) => setLines(event.nativeEvent.lines.length)}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {text}
      </Text>
      <Animated.Text layout={reflow} style={type.body} numberOfLines={open ? undefined : SYNOPSIS_LINES}>
        {text}
      </Animated.Text>
      {long && !open ? <Text style={[type.label, { color: color.ink, marginTop: 2 }]}>More</Text> : null}
    </Tap>
  );
}

const SYNOPSIS_LINES = 3;

function Episodes({ page, watched, current }: { page: Page; watched: Map<string, Watched>; current: string | null }) {
  const { width, fontScale } = useWindowDimensions();
  const fit = episodeFit(width, fontScale);
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
    const near = [seasons[at - 1], seasons[at + 1]].flatMap((s) => s?.episodes.slice(0, NEAR_STILLS) ?? []);

    const stills = near.flatMap((episode) =>
      episode.thumbnail
        ? [
            url(link, '/api/title/art', {
              id: page.id,
              kind: 'thumbnail',
              season: episode.season,
              episode: episode.episode,
            }),
          ]
        : [],
    );

    if (stills.length) Image.prefetch(stills, { cachePolicy: 'memory-disk', headers: authHeaders(link) });
  }, [at, link, page.id, seasons]);

  useEffect(() => {
    if (currentSeason === undefined) return;
    const next = seasons.findIndex((s) => s.number === currentSeason);

    if (next >= 0) position.set(next);
    setSeason(currentSeason);
  }, [currentSeason]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const room = (event.translationX < 0 ? at < last : at > 0) ? 1 : 0.25;
      drag.set(event.translationX * room);
      position.set(Math.min(last, Math.max(0, at - (drag.get() / width) * room)));
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > width * 0.25 || Math.abs(event.velocityX) > 600;
      const next = at + (event.translationX < 0 ? 1 : -1);

      if (far && next >= 0 && next <= last) {
        drag.set(Math.sign(event.translationX) * -width * 0.15);
        position.set(withTiming(next, GLIDE));
        scheduleOnRN(show, next);
      } else {
        position.set(withTiming(at, GLIDE));
      }

      drag.set(withSpring(0, { ...motion.snap, velocity: event.velocityX }));
    });

  const carried = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.get() * 0.5 }],
    opacity: 1 - Math.min(0.5, Math.abs(drag.get()) / width),
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
              fit={fit}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const GLIDE = { duration: 260, easing: motion.out };
const STILL_WIDTH = 136;
const STILL_MIN_WIDTH = 88;

type EpisodeFit = { width: number; height: number; number: number; titleLines: number };

/** The still gives up width as the text grows, so the episode's words keep room on a narrow phone. */
function episodeFit(screenWidth: number, fontScale: number): EpisodeFit {
  const room = (screenWidth * 0.38) / Math.max(1, fontScale * 0.8);
  const width = Math.round(Math.max(STILL_MIN_WIDTH, Math.min(STILL_WIDTH, room)));
  const height = Math.round((width * 77) / STILL_WIDTH);

  return { width, height, number: Math.round(height * 0.52), titleLines: fontScale > 1.15 ? 3 : 2 };
}

const NEAR_STILLS = 6;

function EpisodeRow({
  page,
  episode,
  watched,
  index,
  current,
  fit,
}: {
  page: Page;
  episode: EpisodeInfo;
  watched?: Watched;
  index: number;
  current: boolean;
  fit: EpisodeFit;
}) {
  const video = videoOf(page.id, episode);
  const held = useHeldState(video);
  const { session } = useSession();
  const onComputer = session.state === 'paired' && session.engine.kind !== 'phone';
  const progress = watched?.finished ? 1 : watched?.duration ? watched.position / watched.duration : null;
  const aired = episode.has_aired;

  return (
    <Animated.View entering={rise(index)}>
      <Tap
        shrink={1}
        highlight
        disabled={!aired}
        onPress={() => router.push({ pathname: '/play', params: { video } })}
        accessibilityLabel={`${episodeCode(episode)}, ${episodeName(episode)}${aired ? '' : ', not out yet'}${held === 'none' ? '' : held === 'done' ? (onComputer ? ', on your computer' : ', on this phone') : ', downloading'}`}
        style={[styles.episode, !aired && { opacity: 0.45 }]}
      >
        <View style={[styles.still, { width: fit.width, height: fit.height }]}>
          <Text
            style={[styles.stillNumber, { fontSize: fit.number, maxWidth: fit.width - 16 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            allowFontScaling={false}
            accessible={false}
            importantForAccessibility="no"
          >
            {episode.episode}
          </Text>
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
          <Text style={[type.callout, current && { color: color.action }]} numberOfLines={fit.titleLines}>
            {episode.episode}. {episodeName(episode)}
          </Text>
          <View style={styles.episodeFacts}>
            {episodeFacts(episode, watched, held, onComputer).map((fact, at) => (
              <Text key={fact.text} style={[type.caption, fact.held && { color: color.action }]}>
                {at > 0 ? ' · ' : ''}
                {fact.text}
              </Text>
            ))}
          </View>
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

function episodeFacts(
  episode: EpisodeInfo,
  watched: Watched | undefined,
  held: ReturnType<typeof useHeldState>,
  onComputer: boolean,
): { text: string; held: boolean }[] {
  const pieces = [
    episode.aired ? { text: day(episode.aired), held: false } : null,
    watched?.finished ? { text: 'Watched', held: false } : null,
    held === 'none'
      ? null
      : { text: held === 'done' ? (onComputer ? 'On your computer' : 'On this phone') : 'Downloading', held: true },
  ];

  return pieces.filter((piece) => piece !== null);
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
    backgroundColor: color.paper,
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
    backgroundColor: alpha(color.paper, 0.6),
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
  measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
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
  ringed: { borderWidth: 0 },
  fetched: { marginTop: space.md },
  fetchedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  playDetail: { gap: space.sm, marginTop: space.md },
  seasons: { marginHorizontal: -space.page },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.rule, marginHorizontal: -space.page },
  episode: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    marginHorizontal: -space.page,
    paddingHorizontal: space.page,
  },
  episodeFacts: { flexDirection: 'row', flexWrap: 'wrap' },
  still: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.raised },
  stillNumber: {
    position: 'absolute',
    right: 10,
    bottom: 2,
    fontFamily: font.bold,
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
