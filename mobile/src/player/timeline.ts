import { useEventListener } from 'expo';
import type { VideoMetadata, VideoPlayer, VideoSourceObject } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { FfmpegMessage, MediaInfo, PlayInfo } from '@web/wire';

import { authHeaders, stream, url, type Link } from '@/engine/client';

type Reason = 'audio' | 'container' | 'failed';

/**
 * Where the picture comes from. `pending` is nothing yet, while iOS waits to learn whether it can
 * read the file. `direct` is the original file, read by the player with Range requests. `stream` is
 * the engine's fragmented MP4 from second `from`: the picture copied or re-encoded to H.264, the
 * audio converted to AAC. It cannot seek, so a seek asks for a new stream.
 */
export type Mode =
  | { kind: 'pending' }
  | { kind: 'direct' }
  | { kind: 'stream'; video: 'copy' | 'h264'; from: number; audio: number | null; reason: Reason };

/** Development only: play every video through the engine's stream, to exercise that path on any file. */
export const FORCE_STREAM = { value: false };

/** Audio most phones cannot decode: the player would show the picture in silence. */
const SILENT = /^(dts|truehd|mlp)/i;
/** What AVPlayer opens. ExoPlayer on Android also reads Matroska, AVI and the rest. */
const APPLE_CONTAINER = /mp4|mov|m4v/i;

export function needsAudioConversion(media: MediaInfo, audio: number | null): boolean {
  const track =
    audio === null
      ? (media.audio.find((a) => a.default) ?? media.audio[0])
      : media.audio.find((a) => a.stream === audio);
  return Boolean(track && SILENT.test(track.codec));
}

/** Why the original file cannot play here, or null when it can. */
function obstacle(media: MediaInfo): Reason | null {
  if (__DEV__ && FORCE_STREAM.value) return 'audio';
  if (Platform.OS === 'ios' && !APPLE_CONTAINER.test(media.container)) return 'container';
  if (needsAudioConversion(media, null)) return 'audio';
  return null;
}

/** iOS cannot try the file and fall back cheaply, so it waits for the engine's description first. */
export const STARTS_DIRECT = Platform.OS !== 'ios';

export function sourceFor(link: Link, play: PlayInfo, mode: Mode, metadata: VideoMetadata): VideoSourceObject | null {
  if (mode.kind === 'pending') return null;
  const uri =
    mode.kind === 'direct'
      ? `${link.base}${encodeURI(play.video.url)}`
      : url(link, '/api/stream', {
          id: play.id,
          file: play.video.index,
          t: mode.from.toFixed(3),
          video: mode.video,
          audio: mode.audio,
        });
  return { uri, headers: authHeaders(link), metadata, contentType: 'progressive' };
}

/** Fetches ffmpeg on the engine's computer when it is missing, which the stream needs. */
async function readyFfmpeg(link: Link, media: MediaInfo): Promise<boolean> {
  if (media.ffmpeg === 'ready') return true;
  let ready = false;
  await stream<FfmpegMessage>(link, '/api/ffmpeg', { method: 'POST', body: {} }, (message) => {
    if (message.type === 'ready') ready = true;
  }).catch(() => {});
  return ready;
}

/**
 * One clock for the player whatever the source: `now` and `duration` in the film's own seconds, and
 * `seek` that moves within the file or asks the engine for a stream from there.
 *
 * The original file plays when this phone can read it. When the engine's description says it
 * cannot (Matroska on iOS, DTS or TrueHD audio), or the player fails on it, playback moves down a
 * ladder: the file again (a read that timed out while pieces arrived), then the stream with the
 * picture copied, then re-encoded.
 */
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
  // A stream's timestamps are the file's own, but a player may count from zero; `base` is what to add.
  const base = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const decided = useRef(false);
  const directRetried = useRef(false);

  const now = useCallback(() => base.current + player.currentTime, [player]);

  const switchTo = useCallback(
    async (next: Mode, at: number) => {
      if (next.kind === 'stream' && media && !(await readyFfmpeg(link, media))) return;
      base.current = 0;
      setMode(next);
      const source = sourceFor(link, play, next, metadata);
      if (!source) return;
      await player.replaceAsync(source);
      if (next.kind === 'direct' && at > 0) player.currentTime = at;
      player.play();
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

  useEventListener(player, 'sourceLoad', (event) => {
    setLoadedDuration(event.duration);
    const current = modeRef.current;
    if (current.kind === 'stream') {
      setTimeout(() => {
        base.current = player.currentTime < current.from - 2 ? current.from : 0;
      }, 250);
    }
  });

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error') return;
    const current = modeRef.current;
    const at = now();
    if (current.kind === 'direct' && !directRetried.current) {
      directRetried.current = true;
      setTimeout(() => switchTo({ kind: 'direct' }, at), 1500);
    } else if (current.kind === 'direct') {
      switchTo({ kind: 'stream', video: 'copy', from: at, audio: null, reason: 'failed' }, at);
    } else if (current.kind === 'stream' && current.video === 'copy') {
      switchTo({ ...current, video: 'h264', from: at, reason: 'failed' }, at);
    }
  });

  const seek = useCallback(
    (seconds: number) => {
      const current = modeRef.current;
      const target = Math.max(0, seconds);
      if (current.kind === 'stream') switchTo({ ...current, from: target }, target);
      else player.currentTime = target;
    },
    [player, switchTo],
  );

  const chooseAudio = useCallback(
    (track: number) => {
      const current = modeRef.current;
      const from = now();
      if (current.kind === 'stream') switchTo({ ...current, from, audio: track }, from);
      else switchTo({ kind: 'stream', video: 'copy', from, audio: track, reason: 'audio' }, from);
    },
    [now, switchTo],
  );

  const duration = mode.kind === 'stream' ? (media?.duration ?? 0) : player.duration || loadedDuration;

  return { mode, now, duration, seek, chooseAudio, base };
}
