import { useEventListener } from 'expo';
import type { VideoMetadata, VideoPlayer, VideoSourceObject } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { FfmpegMessage, MediaInfo, PlayInfo } from '@web/wire';

import { authHeaders, stream, url, type Link } from '@/engine/client';
import { jumpTo } from './control';

type Reason = 'audio' | 'container' | 'failed';

export type Mode =
  | { kind: 'pending' }
  | { kind: 'direct' }
  | { kind: 'stream'; video: 'copy' | 'h264'; from: number; audio: number | null; reason: Reason };

const FORCE_STREAM = { value: false };

export function forceStream(on: boolean) {
  FORCE_STREAM.value = on;
}

const SILENT = /^(dts|truehd|mlp)/i;
const APPLE_CONTAINER = /mp4|mov|m4v/i;

export function needsAudioConversion(media: MediaInfo, audio: number | null): boolean {
  const track =
    audio === null
      ? (media.audio.find((a) => a.default) ?? media.audio[0])
      : media.audio.find((a) => a.stream === audio);

  return Boolean(track && SILENT.test(track.codec));
}

function obstacle(media: MediaInfo): Reason | null {
  if (__DEV__ && FORCE_STREAM.value) return 'audio';

  if (Platform.OS === 'ios' && !APPLE_CONTAINER.test(media.container)) return 'container';

  if (needsAudioConversion(media, null)) return 'audio';

  return null;
}

const USES_HLS = Platform.OS === 'ios';

/** iOS cannot try the file and fall back cheaply, so it waits for the engine's description first. */
export const STARTS_DIRECT = Platform.OS !== 'ios';

export function sourceFor(link: Link, play: PlayInfo, mode: Mode, metadata: VideoMetadata): VideoSourceObject | null {
  if (mode.kind === 'pending') return null;

  if (mode.kind === 'direct') {
    return {
      uri: `${link.base}${encodeURI(play.video.url)}`,
      headers: authHeaders(link),
      metadata,
      contentType: 'progressive',
    };
  }

  const query = { id: play.id, file: play.video.index, t: mode.from.toFixed(3), video: mode.video, audio: mode.audio };

  // AVPlayer plays a live conversion only as HLS; ExoPlayer reads the one fragmented MP4 stream.
  return USES_HLS
    ? { uri: url(link, '/api/hls/index.m3u8', query), headers: authHeaders(link), metadata, contentType: 'hls' }
    : { uri: url(link, '/api/stream', query), headers: authHeaders(link), metadata, contentType: 'progressive' };
}

async function readyFfmpeg(link: Link, media: MediaInfo): Promise<boolean> {
  if (media.ffmpeg === 'ready') return true;
  let ready = false;
  await stream<FfmpegMessage>(link, '/api/ffmpeg', { method: 'POST', body: {} }, (message) => {
    if (message.type === 'ready') ready = true;
  }).catch(() => {});

  return ready;
}

export function useTimeline({
  player,
  link,
  play,
  media,
  metadata,
  resumeAt,
}: {
  player: VideoPlayer;
  link: Link;
  play: PlayInfo;
  media: MediaInfo | null;
  metadata: VideoMetadata;
  resumeAt: number;
}) {
  const [mode, setMode] = useState<Mode>(STARTS_DIRECT ? { kind: 'direct' } : { kind: 'pending' });
  const [loadedDuration, setLoadedDuration] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const base = useRef(0);
  const baseKnown = useRef(false);
  const startedAt = useRef<number | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const decided = useRef(false);
  const directRetried = useRef(false);
  const streamRetried = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;

      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const now = useCallback(() => {
    const current = modeRef.current;

    if (current.kind === 'stream' && !baseKnown.current) return current.from;

    return base.current + player.currentTime;
  }, [player]);

  const switchTo = useCallback(
    async (next: Mode, at: number, resume = true) => {
      if (next.kind === 'stream' && media && !(await readyFfmpeg(link, media))) {
        setProblem(
          media.ffmpeg === 'missing'
            ? `This ${next.reason === 'audio' ? 'audio' : 'file'} needs converting, which the engine on a phone cannot do. Play it from a computer's engine.`
            : 'The engine could not get ffmpeg to convert this file.',
        );

        return;
      }

      base.current = 0;
      baseKnown.current = false;
      startedAt.current = null;
      setMode(next);
      const source = sourceFor(link, play, next, metadata);

      if (!source || !alive.current) return;

      try {
        await player.replaceAsync(source);
      } catch {
        return;
      }

      if (!alive.current) return;

      if (next.kind === 'direct' && at > 0) jumpTo(player, at);

      if (resume) player.play();
    },
    [link, media, metadata, play, player],
  );

  useEffect(() => {
    if (!media || decided.current) return;
    decided.current = true;
    const reason = obstacle(media);
    const at = modeRef.current.kind === 'pending' ? resumeAt : player.currentTime;

    if (reason) switchTo({ kind: 'stream', video: 'copy', from: at, audio: null, reason }, at);
    else if (modeRef.current.kind === 'pending') switchTo({ kind: 'direct' }, at);
  }, [media, player, resumeAt, switchTo]);

  useEventListener(player, 'sourceLoad', (event) => setLoadedDuration(event.duration));

  // A stream's player counts from zero (HLS, and some fragmented MP4) or from the file's own
  // timestamps. Each tick picks whichever reading sits nearer where the stream should be by now,
  // judged by the wall clock since it started; the two readings are `from` apart, far more than any
  // buffering stall moves them.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const current = modeRef.current;

    if (current.kind !== 'stream' || !player.playing || currentTime <= 0.05) return;

    if (startedAt.current === null) startedAt.current = Date.now();
    const elapsed = ((Date.now() - startedAt.current) / 1000) * (player.playbackRate || 1);
    const asZeroBased = Math.abs(currentTime - elapsed);
    const asFileTime = Math.abs(currentTime - (current.from + elapsed));
    base.current = asZeroBased < asFileTime ? current.from : 0;
    baseKnown.current = true;
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error') return;
    const current = modeRef.current;
    const at = current.kind === 'stream' ? Math.max(now(), current.from) : now();

    if (current.kind === 'direct' && !directRetried.current) {
      directRetried.current = true;
      retryTimer.current = setTimeout(() => switchTo({ kind: 'direct' }, at), 1500);
    } else if (current.kind === 'direct') {
      switchTo({ kind: 'stream', video: 'copy', from: at, audio: null, reason: 'failed' }, at);
    } else if (current.kind === 'stream' && !streamRetried.current) {
      streamRetried.current = true;
      retryTimer.current = setTimeout(() => switchTo({ ...current, from: at }, at), 1500);
    } else if (current.kind === 'stream' && current.video === 'copy') {
      switchTo({ ...current, video: 'h264', from: at, reason: 'failed' }, at);
    }
  });

  const seek = useCallback(
    (seconds: number) => {
      const current = modeRef.current;
      const target = Math.max(0, seconds);

      if (current.kind === 'stream') switchTo({ ...current, from: target }, target, player.playing);
      else jumpTo(player, target);
    },
    [player, switchTo],
  );

  const chooseAudio = useCallback(
    (track: number) => {
      const current = modeRef.current;
      const from = now();
      const playing = player.playing;

      if (current.kind === 'stream') switchTo({ ...current, from, audio: track }, from, playing);
      else switchTo({ kind: 'stream', video: 'copy', from, audio: track, reason: 'audio' }, from, playing);
    },
    [now, player, switchTo],
  );

  const duration = mode.kind === 'stream' ? (media?.duration ?? 0) : player.duration || loadedDuration;

  return { mode, now, duration, seek, chooseAudio, base, problem };
}
