import { useEvent, useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
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
import { SAVE_EVERY_MS, type EpisodeInfo, type MediaInfo, type PlayInfo, type Position, type Release, type TitleCard } from '@web/wire';

import { authHeaders, get, post } from '@/engine/client';
import { useLink } from '@/engine/session';
import { Icon, icons } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { color, font, motion, space } from '@/theme';

import { SeekBar } from './SeekBar';
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
  const source = `${link.base}${encodeURI(play.video.url)}`;
  const download = { id: play.id, file: play.video.index };

  const player = useVideoPlayer(
    {
      uri: source,
      headers: authHeaders(link),
      metadata: { title: title?.name ?? play.name, artist: episode ? `${episodeCode(episode)} · ${episodeName(episode)}` : undefined },
    },
    (p) => {
      p.timeUpdateEventInterval = 0.5;
      p.showNowPlayingNotification = true;
      p.staysActiveInBackground = false;
      p.keepScreenOnWhilePlaying = true;
      if (resumeAt && resumeAt > 5) p.currentTime = resumeAt;
      p.play();
    },
  );

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const time = useEvent(player, 'timeUpdate', { currentTime: player.currentTime, bufferedPosition: player.bufferedPosition, currentLiveTimestamp: null, currentOffsetFromLive: null });
  const [duration, setDuration] = useState(0);
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [visible, setVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [tracksOpen, setTracksOpen] = useState(false);
  const claimed = useRef(false);

  useEventListener(player, 'sourceLoad', (event) => setDuration(event.duration));

  useEffect(() => {
    const controller = new AbortController();
    get<MediaInfo>(link, `/api/media?id=${play.id}&file=${play.video.index}`, controller.signal).then(setMedia, () => {});
    return () => controller.abort();
  }, [link, play.id, play.video.index]);

  const save = useCallback(() => {
    const position = player.currentTime;
    const length = player.duration || duration || null;
    if (!video || !length || position < 1) return;
    const body: Position = { video, position: Math.min(position, length), duration: length, release: release.id, tab: TAB, starts: !claimed.current };
    claimed.current = true;
    post(link, '/api/watched', body).catch(() => {});
  }, [duration, link, player, release.id, video]);

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
      save();
    };
  }, [save]);

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
    player.currentTime = Math.max(0, Math.min(duration || Infinity, player.currentTime + seconds));
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
  const taps = Gesture.Exclusive(doubleTap, tap);

  const leftStyle = useAnimatedStyle(() => ({ opacity: leftSkip.value }));
  const rightStyle = useAnimatedStyle(() => ({ opacity: rightSkip.value }));

  const buffering = status === 'loading' || (isPlaying && time.bufferedPosition >= 0 && time.bufferedPosition < time.currentTime + 0.5 && status !== 'readyToPlay');
  const heading = title?.name ?? play.name;
  const subheading = episode ? `${episodeCode(episode)} · ${episodeName(episode)}` : title?.year ? String(title.year) : release.name;

  return (
    <View style={styles.screen} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
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
            style={[styles.top, { paddingTop: Math.max(insets.top, space.lg), paddingLeft: insets.left + space.lg, paddingRight: insets.right + space.lg }]}
          >
            <Tap shrink={0.88} onPress={() => router.back()} accessibilityLabel="Close the player" style={styles.round}>
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
            <Tap shrink={0.88} onPress={() => setTracksOpen(true)} accessibilityLabel="Subtitles and audio" style={styles.round}>
              <Icon name={icons.subtitles} size={22} tint={color.ink} />
            </Tap>
            <Tap shrink={0.88} onPress={() => router.push({ pathname: '/tv', params: video ? { video } : { ref: play.id, file: String(play.video.index) } })} accessibilityLabel="Play on TV" style={styles.round}>
              <Icon name={icons.cast} size={22} tint={color.ink} />
            </Tap>
          </View>

          <View style={styles.middle} pointerEvents="box-none">
            <Tap shrink={0.86} onPress={() => skip(-SKIP)} accessibilityLabel={`Back ${SKIP} seconds`} style={styles.side}>
              <Icon name={icons.rewind} size={30} tint={color.ink} />
            </Tap>
            <PlayButton playing={isPlaying} buffering={buffering} onPress={toggle} />
            <Tap shrink={0.86} onPress={() => skip(SKIP)} accessibilityLabel={`Forward ${SKIP} seconds`} style={styles.side}>
              <Icon name={icons.forward} size={30} tint={color.ink} />
            </Tap>
          </View>

          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, space.lg), paddingLeft: insets.left + space.xl, paddingRight: insets.right + space.xl }]}>
            <SeekBar
              position={time.currentTime}
              duration={duration || player.duration || 0}
              buffered={time.bufferedPosition}
              download={download}
              onScrubbing={setScrubbing}
              onSeek={(seconds) => {
                player.currentTime = seconds;
              }}
            />
          </View>
        </Animated.View>
      ) : null}

      {tracksOpen ? <TracksSheet player={player} media={media} onClose={() => setTracksOpen(false)} /> : null}
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
  screen: { flex: 1, backgroundColor: '#000' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heading: { flex: 1, paddingHorizontal: space.sm },
  title: { fontFamily: font.bold, fontSize: 17, color: color.ink, letterSpacing: -0.2 },
  subtitle: { fontFamily: font.regular, fontSize: 13, color: color.soft, marginTop: 1 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56 },
  side: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
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
  errorBox: { alignItems: 'center', gap: space.sm, maxWidth: 360, padding: space.lg, top: '38%' },
  errorText: { fontFamily: font.medium, fontSize: 15, color: color.ink, textAlign: 'center' },
  skip: { position: 'absolute', top: 0, bottom: 0, width: '38%', alignItems: 'center', justifyContent: 'center', gap: 4 },
  skipLeft: { left: 0, borderTopRightRadius: 400, borderBottomRightRadius: 400, backgroundColor: 'rgba(240,233,220,0.08)' },
  skipRight: { right: 0, borderTopLeftRadius: 400, borderBottomLeftRadius: 400, backgroundColor: 'rgba(240,233,220,0.08)' },
  skipText: { fontFamily: font.semibold, fontSize: 14, color: color.ink },
});
