import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bytes, sentence } from '@web/lib/format';
import { titleOf } from '@web/lib/video';
import { CHECKS, episodeCode, episodeName } from '@web/titles/words';

import { Player } from '@/player/Player';
import { useTitlePlay, useTorrentPlay, type Start } from '@/player/start';
import type { Takeover } from '@/player/recovery';
import { forceStream } from '@/player/timeline';
import { Art } from '@/ui/Art';
import { Button } from '@/ui/Button';
import { Icon, icons } from '@/ui/Icon';
import { LoadingMark } from '@/ui/Bands';
import { PlaybackProblem } from '@/player/PlaybackProblem';
import { SourcesSheet } from '@/player/SourcesSheet';
import { mark } from '@/perf';
import { Logo } from '@/ui/Logo';
import { PortalHost } from '@/ui/Portal';
import { Stage } from '@/ui/stage';
import { Tap } from '@/ui/Tap';
import { leave } from '@/ui/leave';
import { stage as color, font, radius, space, stageType as type } from '@/theme';
import { appear, reflow, vanish } from '@/ui/presets';

const CLOSE_ROOM = 44 + space.md;

export default function PlayScreen() {
  return (
    <Stage value>
      <Play />
    </Stage>
  );
}

function Play() {
  const { video, ref, file, source, at, stream } = useLocalSearchParams<{
    video?: string;
    ref?: string;
    file?: string;
    source?: string;
    at?: string;
    stream?: string;
  }>();

  if (__DEV__) forceStream(stream === '1');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => mark('play'), []);

  return ref ? (
    <ByTorrent
      torrent={ref}
      file={file ? Number(file) : undefined}
      at={at ? Number(at) : null}
      attempt={attempt}
      retry={() => setAttempt((n) => n + 1)}
    />
  ) : (
    <ByTitle
      video={video ?? ''}
      source={source}
      at={at ? Number(at) : null}
      attempt={attempt}
      retry={() => setAttempt((n) => n + 1)}
    />
  );
}

function ByTorrent({
  torrent,
  file,
  at,
  attempt,
  retry,
}: {
  torrent: string;
  file?: number;
  at: number | null;
  attempt: number;
  retry: () => void;
}) {
  const start = useTorrentPlay(torrent, attempt, file);

  if (start.phase === 'ready') {
    return <Player video={null} play={start.play} release={start.release} resumeAt={at} title={null} episode={null} />;
  }

  return <Starting video={null} start={start} onRetry={retry} />;
}

function ByTitle({
  video,
  source,
  at,
  attempt,
  retry,
}: {
  video: string;
  source?: string;
  at: number | null;
  attempt: number;
  retry: () => void;
}) {
  const start = useTitlePlay(video, attempt, source);
  const [takeover, setTakeover] = useState<{ from: Start; to: Takeover } | null>(null);

  if (start.phase === 'ready') {
    const shown = takeover?.from === start ? takeover.to : null;

    return (
      <Player
        key={shown?.play.id ?? start.play.id}
        video={video}
        play={shown?.play ?? start.play}
        release={shown?.release ?? start.release}
        resumeAt={shown ? shown.at : (at ?? start.resumeAt)}
        title={start.title}
        episode={start.episode}
        switched={shown !== null}
        onTakeover={(to) => setTakeover({ from: start, to })}
      />
    );
  }

  return <Starting video={video} pinned={Boolean(source)} start={start} onRetry={retry} />;
}

function stepOf(start: Start): string {
  switch (start.phase) {
    case 'finding':
      return start.title ? 'Finding sources' : 'Getting the torrent’s files';
    case 'trying':
      return start.check ? CHECKS[start.check].replace(/\.$/, '') : `Trying source ${start.rank} of ${start.of}`;
    default:
      return '';
  }
}

function Starting({
  video,
  pinned = false,
  start,
  onRetry,
}: {
  video: string | null;
  pinned?: boolean;
  start: Exclude<Start, { phase: 'ready' }>;
  onRetry: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [choosing, setChoosing] = useState(false);
  const id = video ? titleOf(video) : null;
  const name = start.title?.name ?? '';

  const detail = start.episode
    ? `${episodeCode(start.episode)} · ${episodeName(start.episode)}`
    : start.title?.year
      ? String(start.title.year)
      : '';

  return (
    <PortalHost>
      <View style={styles.screen}>
        {id ? <Art id={id} kind="background" style={StyleSheet.absoluteFill} placeholder={false} /> : null}
        <LinearGradient
          colors={['rgba(10,9,7,0.55)', 'rgba(10,9,7,0.82)', '#0a0907']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.top, { paddingTop: Math.max(insets.top, space.lg), paddingLeft: insets.left + space.lg }]}>
          <Tap shrink={0.88} onPress={leave} accessibilityLabel="Cancel" style={styles.round}>
            <Icon name={icons.close} size={24} tint={color.ink} />
          </Tap>
        </View>
        {start.phase === 'failed' ? (
          <PlaybackProblem
            align="start"
            room={{ sides: CLOSE_ROOM }}
            title={name}
            detail={detail}
            message={sentence(start.message)}
            hint={start.hint && !(video && pinned) ? sentence(start.hint) : null}
            actions={
              <>
                {video && pinned ? (
                  <Button
                    label="Find another source"
                    icon={icons.play}
                    onPress={() => router.replace({ pathname: '/play', params: { video } })}
                  />
                ) : null}
                {video ? (
                  <Button
                    label="Choose a source"
                    icon={icons.episodes}
                    kind={pinned ? 'secondary' : 'primary'}
                    onPress={() => setChoosing(true)}
                  />
                ) : null}
                {video && pinned ? null : (
                  <Button
                    label="Try again"
                    icon={icons.refresh}
                    kind={video ? 'secondary' : 'primary'}
                    onPress={onRetry}
                  />
                )}
                <Button label="Back" kind="quiet" onPress={leave} />
              </>
            }
          />
        ) : (
          <View style={[styles.body, { paddingLeft: insets.left + 56, paddingRight: insets.right + 56 }]}>
            {id && name ? <Logo id={id} name={name} style={styles.logo} /> : <View style={styles.logo} />}
            {detail ? <Text style={styles.detail}>{detail}</Text> : null}
            <View style={styles.progress}>
              <View style={styles.stepLine}>
                <LoadingMark size={22} label="Starting" />
                <Animated.Text
                  key={stepOf(start)}
                  entering={appear}
                  exiting={vanish}
                  layout={reflow}
                  style={styles.step}
                >
                  {stepOf(start)}
                </Animated.Text>
              </View>
              {start.phase === 'trying' ? (
                <Animated.Text key={start.release.id} entering={appear} style={styles.release} numberOfLines={1}>
                  {[
                    start.release.quality.resolution?.toUpperCase(),
                    start.release.size ? bytes(start.release.size) : null,
                    start.release.seeders !== null ? `${start.release.seeders} seeds` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Animated.Text>
              ) : null}
            </View>
          </View>
        )}
        {choosing && video ? (
          <SourcesSheet
            video={video}
            label={detail || name}
            onPick={(release) => {
              setChoosing(false);
              router.replace({ pathname: '/play', params: { video, source: release.id } });
            }}
            onClose={() => setChoosing(false)}
          />
        ) : null}
      </View>
    </PortalHost>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0907' },
  top: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,18,15,0.5)',
  },
  body: { flex: 1, justifyContent: 'center', gap: space.md, maxWidth: 640 },
  logo: { height: 72, width: '70%' },
  detail: { fontFamily: font.medium, fontSize: 16, color: color.soft },
  progress: { gap: space.md, marginTop: space.lg, maxWidth: 420 },
  step: { flex: 1, fontFamily: font.semibold, fontSize: 17, color: color.ink },
  stepLine: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  release: { ...type.numeric, color: color.pencil },
  radius: { borderRadius: radius.md },
});
