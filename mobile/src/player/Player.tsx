import { useEvent, useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { episodeCode, episodeName, findEpisode, playingOrder } from '@web/titles/words';
import {
  SAVE_EVERY_MS,
  type EpisodeInfo,
  type MediaInfo,
  type PlayInfo,
  type Position,
  type Release,
  type TitleCard,
  type TitlePage,
} from '@web/wire';

import { useQueryClient } from '@tanstack/react-query';

import { titleOf, videoOf } from '@web/lib/video';

import { get, post } from '@/engine/client';
import { keys, useTitle } from '@/engine/queries';
import { useLink } from '@/engine/session';
import { LoadingMark } from '@/ui/Bands';
import { Glass } from '@/ui/Glass';
import { Icon, icons } from '@/ui/Icon';
import { PortalHost } from '@/ui/Portal';
import { Tap } from '@/ui/Tap';
import { stage as color, font, motion, space } from '@/theme';

import { useDownloaded, usePlayingJob } from './downloaded';
import { Ended, type UpNext } from './Ended';
import { FilesSheet, videosOf } from './FilesSheet';
import { usePlayerPreferences } from './preferences';
import { RecoveryNotice, useStallRecovery, type Takeover } from './recovery';
import { SeekBar } from './SeekBar';
import { sourceFor, STARTS_DIRECT, useTimeline } from './timeline';
import { SettingsSheet } from './SettingsSheet';
import { SwipeLevel, useSideSwipes } from './swipes';
import { SubtitleLook } from './SubtitleLook';
import { SourcesSheet } from './SourcesSheet';
import { choiceKey, SubtitleOverlay, useOnlineSubtitles, useSubtitleCues, type SubtitleChoice } from './Subtitles';
import { TracksSheet } from './TracksSheet';

const HIDE_AFTER_MS = 3200;
const SKIP = 10;

type OpenSheet = 'tracks' | 'settings' | 'sources' | 'files';

function nextEpisode(page: TitlePage | null, video: string | null): UpNext | null {
  const here = page && video ? findEpisode(page, video) : null;
  if (!page || !here) return null;
  const order = playingOrder(page, here.season === 0);
  const at = order.findIndex((e) => e.season === here.season && e.episode === here.episode);
  const following = at === -1 ? undefined : order[at + 1];
  return following
    ? {
        video: videoOf(page.id, following),
        name: `${episodeCode(following)} · ${episodeName(following)}`,
        title: page.id,
        season: following.season,
        episode: following.episode,
        still: Boolean(following.thumbnail),
      }
    : null;
}

const TAB = Math.random().toString(36).slice(2, 10);

export function Player({
  video,
  play,
  release,
  resumeAt,
  title,
  episode,
  switched = false,
  onTakeover,
}: {
  video: string | null;
  play: PlayInfo;
  release: Release;
  resumeAt: number | null;
  title: TitleCard | null;
  episode: EpisodeInfo | null;
  switched?: boolean;
  onTakeover?: (takeover: Takeover) => void;
}) {
  const link = useLink();
  const insets = useSafeAreaInsets();
  const download = { id: play.id, file: play.video.index };
  const job = usePlayingJob(play.job);
  const downloaded = useDownloaded(job, play.video, play.total_size);
  const [metadata] = useState(() => ({
    title: title?.name ?? play.name,
    artist: episode ? `${episodeCode(episode)} · ${episodeName(episode)}` : undefined,
  }));

  const player = useVideoPlayer(
    sourceFor(link, play, STARTS_DIRECT ? { kind: 'direct' } : { kind: 'pending' }, metadata),
    (p) => {
      p.timeUpdateEventInterval = 0.25;
      p.showNowPlayingNotification = true;
      p.staysActiveInBackground = false;
      p.keepScreenOnWhilePlaying = true;
      if (resumeAt && resumeAt > 5) p.currentTime = resumeAt;
      p.play();
    },
  );

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { status, error } = useEvent(player, 'statusChange', {
    status: player.status,
    error: undefined,
  });
  const time = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    bufferedPosition: player.bufferedPosition,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const timeline = useTimeline({
    player,
    link,
    play,
    media,
    metadata,
    resumeAt: resumeAt && resumeAt > 5 ? resumeAt : 0,
  });
  const duration = timeline.duration;
  const position = time.currentTime >= 0 ? timeline.now() : 0;
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [preferences, setPreferences] = usePlayerPreferences();
  const resumed = useRef(true);
  const held = useRef(false);
  const { recovery, retry } = useStallRecovery({
    video: onTakeover ? video : null,
    play,
    job,
    player,
    status,
    held,
    now: timeline.now,
    onTakeover: (takeover) => onTakeover?.(takeover),
  });
  const client = useQueryClient();
  const [drawn, setDrawn] = useState<SubtitleChoice | null>(null);
  const cues = useSubtitleCues(play, drawn);
  const online = useOnlineSubtitles(play.id, play.video.index);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const drawnKey = drawn ? choiceKey(drawn) : null;
  const offset = drawnKey ? (offsets[drawnKey] ?? 0) : null;
  const subtitleFiles = play.subtitles.map((file) => ({
    kind: 'file' as const,
    index: file.index,
    name: file.path.split('/').pop() ?? file.path,
  }));
  const videos = useMemo(() => (video ? [] : videosOf(play)), [video, play]);

  const [ended, setEnded] = useState(false);
  const page = useTitle(video ? titleOf(video) : '', Boolean(video && episode));
  const next = nextEpisode(page.data ?? null, video);
  useEventListener(player, 'playToEnd', () => {
    setEnded(true);
    setVisible(false);
  });
  useEventListener(player, 'playingChange', (event) => {
    if (!event.isPlaying) return;
    resumed.current = true;
    held.current = false;
  });

  useEffect(() => {
    const controller = new AbortController();
    get<MediaInfo>(link, `/api/media?id=${play.id}&file=${play.video.index}`, controller.signal).then(
      setMedia,
      () => {},
    );
    return () => controller.abort();
  }, [link, play.id, play.video.index]);

  const now = timeline.now;
  const save = useCallback(() => {
    const at = now();
    const length = duration || null;
    if (!video || !length || at < 1) return Promise.resolve();
    const body: Position = {
      video,
      position: Math.min(at, length),
      duration: length,
      release: release.id,
      tab: TAB,
      starts: resumed.current,
    };
    resumed.current = false;
    return post(link, '/api/watched', body).then(
      () => {},
      () => {},
    );
  }, [duration, link, now, release.id, video]);

  useEffect(() => {
    if (!isPlaying) {
      save();
      return;
    }
    const timer = setInterval(save, SAVE_EVERY_MS);
    return () => clearInterval(timer);
  }, [isPlaying, save]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state !== 'active' && save());
    return () => {
      subscription.remove();
      save().then(() => {
        client.invalidateQueries({ queryKey: keys.home });
        if (video) client.invalidateQueries({ queryKey: keys.title(titleOf(video)) });
      });
    };
  }, [save, client, video]);

  useEffect(() => {
    if (!visible || !isPlaying || scrubbing || sheet) return;
    const timer = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible, isPlaying, scrubbing, sheet]);

  useEffect(() => {
    player.playbackRate = preferences.speed;
  }, [player, preferences.speed]);

  const toggle = () => {
    held.current = player.playing;
    if (player.playing) player.pause();
    else player.play();
  };

  const leftSkip = useSharedValue(0);
  const rightSkip = useSharedValue(0);
  const flash = (side: 'left' | 'right') => {
    const value = side === 'left' ? leftSkip : rightSkip;
    value.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 520, easing: motion.out }));
  };
  const skip = (seconds: number) => {
    timeline.seek(Math.min(duration || Infinity, timeline.now() + seconds));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flash(seconds < 0 ? 'left' : 'right');
  };

  const [{ width, height: screenHeight }, setSize] = useState({ width: 1, height: 1 });
  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .runOnJS(true)
    .onEnd(() => setVisible((shown) => !shown));
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(240)
    .runOnJS(true)
    .onEnd((event) => skip(event.x < width / 2 ? -SKIP : SKIP));
  const drop = useSharedValue(0);
  const close = () => router.back();
  const sides = useSideSwipes({ width, height: screenHeight });
  const pullDown = Gesture.Pan()
    .hitSlop(sides.middle)
    .activeOffsetY(18)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      drop.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 800) {
        drop.value = withTiming(600, { duration: 180, easing: motion.out });
        runOnJS(close)();
      } else {
        drop.value = withSpring(0, motion.settle);
      }
    });
  const taps = Gesture.Race(pullDown, sides.swipe, Gesture.Exclusive(doubleTap, tap));
  const dropStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value * 0.8 }, { scale: 1 - Math.min(drop.value, 400) / 2400 }],
    borderRadius: Math.min(drop.value / 6, 24),
    opacity: 1 - Math.min(drop.value, 600) / 1200,
  }));

  const leftStyle = useAnimatedStyle(() => ({ opacity: leftSkip.value }));
  const rightStyle = useAnimatedStyle(() => ({ opacity: rightSkip.value }));

  const buffering =
    status === 'loading' ||
    (isPlaying &&
      time.bufferedPosition >= 0 &&
      time.bufferedPosition < time.currentTime + 0.5 &&
      status !== 'readyToPlay');
  const heading = title?.name ?? play.name;
  const subheading = episode
    ? `${episodeCode(episode)} · ${episodeName(episode)}`
    : title?.year
      ? String(title.year)
      : release.name;

  return (
    <PortalHost>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.screen, dropStyle]} onLayout={(event) => setSize(event.nativeEvent.layout)}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls={false}
            contentFit="contain"
            allowsPictureInPicture
            startsPictureInPictureAutomatically
          />
          <GestureDetector gesture={taps}>
            <View style={StyleSheet.absoluteFill}>
              <SwipeLevel kind={sides.kind} level={sides.level} shown={sides.shown} />
              <Animated.View style={[styles.skip, styles.skipLeft, leftStyle]} pointerEvents="none">
                <Icon name={icons.rewind} size={30} tint={color.ink} />
                <Text style={styles.skipText}>{SKIP} s</Text>
              </Animated.View>
              <Animated.View style={[styles.skip, styles.skipRight, rightStyle]} pointerEvents="none">
                <Icon name={icons.forward} size={30} tint={color.ink} />
                <Text style={styles.skipText}>{SKIP} s</Text>
              </Animated.View>
            </View>
          </GestureDetector>

          {buffering && !visible ? (
            <View style={styles.center} pointerEvents="none">
              <LoadingMark size={40} label="Loading" />
            </View>
          ) : null}

          {status === 'error' || timeline.problem ? (
            <View style={[styles.center, styles.errorBox]}>
              <Icon name={icons.warning} size={28} tint={color.error} />
              <Text style={styles.errorText}>
                {timeline.problem ?? error?.message ?? 'This video does not play on this phone.'}
              </Text>
            </View>
          ) : null}

          {visible ? (
            <Animated.View
              entering={FadeIn.duration(motion.quick)}
              exiting={FadeOut.duration(motion.quick)}
              style={StyleSheet.absoluteFill}
              pointerEvents="box-none"
            >
              <View style={styles.scrim} pointerEvents="none" />
              <View
                style={[
                  styles.top,
                  {
                    paddingTop: Math.max(insets.top, space.lg),
                    paddingLeft: insets.left + space.lg,
                    paddingRight: insets.right + space.lg,
                  },
                ]}
              >
                <Tap
                  shrink={0.88}
                  onPress={() => router.back()}
                  accessibilityLabel="Close the player"
                  style={styles.round}
                >
                  <Glass interactive fallback="transparent" style={styles.disc}>
                    <Icon name={icons.back} size={24} tint={color.ink} />
                  </Glass>
                </Tap>
                <View style={styles.heading}>
                  <Text style={styles.title} numberOfLines={1}>
                    {heading}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {subheading}
                  </Text>
                </View>
                <Glass fallback="transparent" style={styles.capsule}>
                  {videos.length > 1 ? (
                    <Tap
                      shrink={0.88}
                      onPress={() => setSheet('files')}
                      accessibilityLabel="Videos in this torrent"
                      style={styles.round}
                    >
                      <Icon name={icons.episodes} size={22} tint={color.ink} />
                    </Tap>
                  ) : null}
                  <Tap
                    shrink={0.88}
                    onPress={() => setSheet('tracks')}
                    accessibilityLabel="Subtitles and audio"
                    style={styles.round}
                  >
                    <Icon name={icons.subtitles} size={22} tint={color.ink} />
                  </Tap>
                  <Tap
                    shrink={0.88}
                    onPress={() => setSheet('settings')}
                    accessibilityLabel="Settings"
                    style={styles.round}
                  >
                    <Icon name={icons.settings} size={22} tint={color.ink} />
                  </Tap>
                  <Tap
                    shrink={0.88}
                    onPress={() => {
                      const at = String(Math.floor(timeline.now()));
                      player.pause();
                      router.push({
                        pathname: '/tv',
                        params: video ? { video, at } : { ref: play.id, file: String(play.video.index), at },
                      });
                    }}
                    accessibilityLabel="Play on TV"
                    style={styles.round}
                  >
                    <Icon name={icons.cast} size={22} tint={color.ink} />
                  </Tap>
                </Glass>
              </View>

              <View style={styles.middle} pointerEvents="box-none">
                <Tap
                  shrink={0.86}
                  onPress={() => skip(-SKIP)}
                  accessibilityLabel={`Back ${SKIP} seconds`}
                  style={styles.side}
                >
                  <Glass interactive fallback="transparent" style={styles.disc}>
                    <Icon name={icons.rewind} size={30} tint={color.ink} />
                  </Glass>
                </Tap>
                <PlayButton playing={isPlaying} buffering={buffering} onPress={toggle} />
                <Tap
                  shrink={0.86}
                  onPress={() => skip(SKIP)}
                  accessibilityLabel={`Forward ${SKIP} seconds`}
                  style={styles.side}
                >
                  <Glass interactive fallback="transparent" style={styles.disc}>
                    <Icon name={icons.forward} size={30} tint={color.ink} />
                  </Glass>
                </Tap>
              </View>

              <View
                style={[
                  styles.bottom,
                  {
                    paddingBottom: Math.max(insets.bottom, space.lg),
                    paddingLeft: insets.left + space.xl,
                    paddingRight: insets.right + space.xl,
                  },
                ]}
              >
                <SeekBar
                  position={position}
                  duration={duration || player.duration || 0}
                  buffered={timeline.base.current + time.bufferedPosition}
                  download={download}
                  downloaded={downloaded}
                  onScrubbing={setScrubbing}
                  onSeek={(seconds) => {
                    if (duration <= 0) return;
                    timeline.seek(seconds);
                  }}
                />
              </View>
            </Animated.View>
          ) : null}

          <SubtitleOverlay
            cues={cues}
            time={position - (offset ?? 0)}
            lifted={visible}
            look={preferences.subtitleStyle}
          />

          <RecoveryNotice recovery={recovery} switched={switched} onRetry={retry} />

          {ended ? (
            <Ended
              next={next}
              onNext={() => next && router.replace({ pathname: '/play', params: { video: next.video } })}
              onReplay={() => {
                setEnded(false);
                timeline.seek(0);
                player.play();
              }}
              onBack={() => router.back()}
            />
          ) : null}

          {sheet === 'tracks' ? (
            <TracksSheet
              player={player}
              media={media}
              streamAudio={
                timeline.mode.kind === 'stream' && media
                  ? { tracks: media.audio, selected: timeline.mode.audio, onSelect: timeline.chooseAudio }
                  : null
              }
              files={subtitleFiles}
              online={online}
              drawn={drawn}
              onDraw={(choice) => {
                setDrawn(choice);
                if (choice) player.subtitleTrack = null;
              }}
              look={
                <SubtitleLook
                  offset={offset}
                  onShift={(seconds) => drawnKey && setOffsets((previous) => ({ ...previous, [drawnKey]: seconds }))}
                  style={preferences.subtitleStyle}
                  onStyle={(change) => setPreferences({ subtitleStyle: { ...preferences.subtitleStyle, ...change } })}
                />
              }
              onClose={() => setSheet(null)}
            />
          ) : null}

          {sheet === 'settings' ? (
            <SettingsSheet
              source={video ? release : null}
              onSources={() => setSheet('sources')}
              speed={preferences.speed}
              onSpeed={(speed) => setPreferences({ speed })}
              onClose={() => setSheet(null)}
            />
          ) : null}

          {sheet === 'sources' && video ? (
            <SourcesSheet
              video={video}
              label={episode ? subheading : heading}
              current={release.id}
              onPick={(source) => {
                const at = String(Math.floor(timeline.now()));
                setSheet(null);
                player.pause();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                save().catch(() => {});
                router.replace({ pathname: '/play', params: { video, source: source.id, at } });
              }}
              onClose={() => setSheet(null)}
            />
          ) : null}

          {sheet === 'files' ? (
            <FilesSheet
              videos={videos}
              current={play.video.index}
              onPick={(file) => {
                setSheet(null);
                router.replace({ pathname: '/play', params: { ref: play.id, file: String(file.index) } });
              }}
              onClose={() => setSheet(null)}
            />
          ) : null}
        </Animated.View>
      </View>
    </PortalHost>
  );
}

function PlayButton({ playing, buffering, onPress }: { playing: boolean; buffering: boolean; onPress: () => void }) {
  const pop = useSharedValue(1);
  useEffect(() => {
    pop.value = withSequence(withTiming(0.85, { duration: 80 }), withSpring(1, motion.pop));
  }, [playing, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Tap shrink={0.9} onPress={onPress} accessibilityLabel={playing ? 'Pause' : 'Play'} style={styles.playButton}>
      <Glass interactive fallback="rgba(20, 18, 15, 0.5)" style={styles.disc}>
        {buffering ? (
          <LoadingMark size={34} label="Loading" />
        ) : (
          <Animated.View style={style}>
            <Icon name={playing ? icons.pause : icons.play} size={38} tint={color.ink} filled />
          </Animated.View>
        )}
      </Glass>
    </Tap>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.paper },
  screen: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heading: { flex: 1, paddingHorizontal: space.sm },
  title: {
    fontFamily: font.bold,
    fontSize: 17,
    color: color.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: color.soft,
    marginTop: 1,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 56,
  },
  side: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: { width: 76, height: 76 },
  disc: { flex: 1, alignSelf: 'stretch', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  capsule: { flexDirection: 'row', alignItems: 'center', borderRadius: 22 },
  bottom: { paddingTop: space.sm },
  center: { position: 'absolute', alignSelf: 'center', top: '45%' },
  errorBox: {
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 360,
    padding: space.lg,
    top: '38%',
  },
  errorText: {
    fontFamily: font.medium,
    fontSize: 15,
    color: color.ink,
    textAlign: 'center',
  },
  skip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '38%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  skipLeft: {
    left: 0,
    borderTopRightRadius: 400,
    borderBottomRightRadius: 400,
    backgroundColor: 'rgba(240,233,220,0.08)',
  },
  skipRight: {
    right: 0,
    borderTopLeftRadius: 400,
    borderBottomLeftRadius: 400,
    backgroundColor: 'rgba(240,233,220,0.08)',
  },
  skipText: { fontFamily: font.semibold, fontSize: 14, color: color.ink },
});
