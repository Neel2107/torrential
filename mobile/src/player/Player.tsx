import { useEvent, useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
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

import { episodeCode, episodeName } from '@web/titles/words';
import {
  SAVE_EVERY_MS,
  type EpisodeInfo,
  type MediaInfo,
  type PlayInfo,
  type Position,
  type Release,
  type TitleCard,
} from '@web/wire';

import { useQueryClient } from '@tanstack/react-query';

import { titleOf } from '@web/lib/video';

import { get, post } from '@/engine/client';
import { keys } from '@/engine/queries';
import { useLink } from '@/engine/session';
import { Icon, icons } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { color, font, motion, space } from '@/theme';

import { SeekBar } from './SeekBar';
import { sourceFor, useTimeline } from './timeline';
import { SubtitleOverlay, useSubtitleFile, type SubtitleFile } from './Subtitles';
import { TracksSheet } from './TracksSheet';

const HIDE_AFTER_MS = 3200;
const SKIP = 10;

/** A random name for this screen, so the engine knows which player owns the saved position. */
const TAB = Math.random().toString(36).slice(2, 10);

export function Player({
  video,
  play,
  release,
  resumeAt,
  title,
  episode,
}: {
  video: string | null;
  play: PlayInfo;
  release: Release;
  resumeAt: number | null;
  title: TitleCard | null;
  episode: EpisodeInfo | null;
}) {
  const link = useLink();
  const insets = useSafeAreaInsets();
  const download = { id: play.id, file: play.video.index };
  const [metadata] = useState(() => ({
    title: title?.name ?? play.name,
    artist: episode ? `${episodeCode(episode)} · ${episodeName(episode)}` : undefined,
  }));

  const player = useVideoPlayer(sourceFor(link, play, { kind: 'direct' }, metadata), (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.showNowPlayingNotification = true;
    p.staysActiveInBackground = false;
    p.keepScreenOnWhilePlaying = true;
    if (resumeAt && resumeAt > 5) p.currentTime = resumeAt;
    p.play();
  });

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
  const timeline = useTimeline({ player, link, play, media, metadata });
  const duration = timeline.duration;
  const position = timeline.base.current + time.currentTime;
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  // Each time this screen starts or resumes playback it claims the saved place, as the web player does.
  const resumed = useRef(true);
  const client = useQueryClient();
  const [subtitleFile, setSubtitleFile] = useState<SubtitleFile | null>(null);
  const cues = useSubtitleFile(play.id, subtitleFile);
  const subtitleFiles: SubtitleFile[] = play.subtitles.map((file) => ({
    index: file.index,
    name: file.path.split('/').pop() ?? file.path,
  }));

  useEventListener(player, 'playingChange', (event) => {
    if (event.isPlaying) resumed.current = true;
  });

  useEffect(() => {
    const controller = new AbortController();
    get<MediaInfo>(link, `/api/media?id=${play.id}&file=${play.video.index}`, controller.signal).then(
      setMedia,
      () => {},
    );
    return () => controller.abort();
  }, [link, play.id, play.video.index]);

  const save = useCallback(() => {
    const at = timeline.now();
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
  }, [duration, link, timeline, release.id, video]);

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
    if (!visible || !isPlaying || scrubbing || tracksOpen) return;
    const timer = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible, isPlaying, scrubbing, tracksOpen]);

  const toggle = () => (player.playing ? player.pause() : player.play());

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

  const [width, setWidth] = useState(1);
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
  const pullDown = Gesture.Pan()
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
  const taps = Gesture.Race(pullDown, Gesture.Exclusive(doubleTap, tap));
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
    <View style={styles.backdrop}>
      <Animated.View style={[styles.screen, dropStyle]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
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

        {buffering && !visible ? <ActivityIndicator style={styles.center} size="large" color={color.ink} /> : null}

        {status === 'error' ? (
          <View style={[styles.center, styles.errorBox]}>
            <Icon name={icons.warning} size={28} tint={color.error} />
            <Text style={styles.errorText}>{error?.message ?? 'This video does not play on this phone.'}</Text>
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
                <Icon name={icons.back} size={24} tint={color.ink} />
              </Tap>
              <View style={styles.heading}>
                <Text style={styles.title} numberOfLines={1}>
                  {heading}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subheading}
                </Text>
              </View>
              <Tap
                shrink={0.88}
                onPress={() => setTracksOpen(true)}
                accessibilityLabel="Subtitles and audio"
                style={styles.round}
              >
                <Icon name={icons.subtitles} size={22} tint={color.ink} />
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
            </View>

            <View style={styles.middle} pointerEvents="box-none">
              <Tap
                shrink={0.86}
                onPress={() => skip(-SKIP)}
                accessibilityLabel={`Back ${SKIP} seconds`}
                style={styles.side}
              >
                <Icon name={icons.rewind} size={30} tint={color.ink} />
              </Tap>
              <PlayButton playing={isPlaying} buffering={buffering} onPress={toggle} />
              <Tap
                shrink={0.86}
                onPress={() => skip(SKIP)}
                accessibilityLabel={`Forward ${SKIP} seconds`}
                style={styles.side}
              >
                <Icon name={icons.forward} size={30} tint={color.ink} />
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
                position={time.currentTime}
                duration={duration || player.duration || 0}
                buffered={time.bufferedPosition}
                download={download}
                onScrubbing={setScrubbing}
                onSeek={(seconds) => {
                  if (duration <= 0) return;
                  timeline.seek(seconds);
                }}
              />
            </View>
          </Animated.View>
        ) : null}

        <SubtitleOverlay cues={cues} time={position} lifted={visible} />

        {tracksOpen ? (
          <TracksSheet
            player={player}
            media={media}
            streamAudio={
              timeline.mode.kind === 'stream' && media
                ? { tracks: media.audio, selected: timeline.mode.audio, onSelect: timeline.chooseAudio }
                : null
            }
            files={subtitleFiles}
            file={subtitleFile}
            onFile={(file) => {
              setSubtitleFile(file);
              if (file) player.subtitleTrack = null;
            }}
            onClose={() => setTracksOpen(false)}
          />
        ) : null}
      </Animated.View>
    </View>
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
      {buffering ? (
        <ActivityIndicator size="large" color={color.ink} />
      ) : (
        <Animated.View style={style}>
          <Icon name={playing ? icons.pause : icons.play} size={38} tint={color.ink} filled />
        </Animated.View>
      )}
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
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 18, 15, 0.5)',
  },
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
