import { useEventListener } from 'expo';
import type { VideoMetadata, VideoPlayer, VideoSourceObject } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FfmpegMessage, MediaInfo, PlayInfo } from '@web/wire';

import { authHeaders, stream, url, type Link } from '@/engine/client';

/**
 * Where the picture comes from. `direct` is the original file, read by ExoPlayer with Range requests.
 * `stream` is the engine's fragmented MP4 from second `from`: the picture copied or re-encoded to
 * H.264, the audio converted to AAC. It cannot seek, so a seek asks for a new stream.
 */
export type Mode =
  | { kind: 'direct' }
  | { kind: 'stream'; video: 'copy' | 'h264'; from: number; audio: number | null; reason: 'audio' | 'failed' };

/** Development only: play every video through the engine's stream, to exercise that path on any file. */
export const FORCE_STREAM = { value: false };

/** Audio most phones cannot decode: ExoPlayer would play the picture in silence. */
const SILENT = /^(dts|truehd|mlp)/i;

export function needsAudioConversion(media: MediaInfo, audio: number | null): boolean {
  const track =
    audio === null
      ? (media.audio.find((a) => a.default) ?? media.audio[0])
      : media.audio.find((a) => a.stream === audio);
  return Boolean(track && SILENT.test(track.codec));
}

export function sourceFor(link: Link, play: PlayInfo, mode: Mode, metadata: VideoMetadata): VideoSourceObject {
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
 */
export function useTimeline({
  player,
  link,
  play,
  media,
  metadata,
}: {
  player: VideoPlayer;
  link: Link;
  play: PlayInfo;
  media: MediaInfo | null;
  metadata: VideoMetadata;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'direct' });
  const forced = useRef(false);
  const [loadedDuration, setLoadedDuration] = useState(0);
  // A stream's timestamps are the file's own, but a player may count from zero; `base` is what to add.
  const base = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const now = useCallback(() => base.current + player.currentTime, [player]);

  const switchTo = useCallback(
    async (next: Mode) => {
      if (next.kind === 'stream' && media && !(await readyFfmpeg(link, media))) return;
      base.current = 0;
      setMode(next);
      await player.replaceAsync(sourceFor(link, play, next, metadata));
      player.play();
    },
    [link, media, metadata, play, player],
  );

  useEventListener(player, 'sourceLoad', (event) => {
    setLoadedDuration(event.duration);
    const current = modeRef.current;
    if (current.kind === 'stream') {
      setTimeout(() => {
        base.current = player.currentTime < current.from - 2 ? current.from : 0;
      }, 250);
    }
  });

  useEffect(() => {
    if (!media || mode.kind !== 'direct' || forced.current) return;
    if (__DEV__ && FORCE_STREAM.value) {
      forced.current = true;
      switchTo({ kind: 'stream', video: 'copy', from: player.currentTime, audio: null, reason: 'audio' });
      return;
    }
    if (!needsAudioConversion(media, null)) return;
    switchTo({ kind: 'stream', video: 'copy', from: player.currentTime, audio: null, reason: 'audio' });
  }, [media, mode.kind, player, switchTo]);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status !== 'error' || modeRef.current.kind !== 'direct') return;
    switchTo({ kind: 'stream', video: 'h264', from: player.currentTime, audio: null, reason: 'failed' });
  });

  const seek = useCallback(
    (seconds: number) => {
      const current = modeRef.current;
      const target = Math.max(0, seconds);
      if (current.kind === 'direct') {
        player.currentTime = target;
        return;
      }
      switchTo({ ...current, from: target });
    },
    [player, switchTo],
  );

  const chooseAudio = useCallback(
    (stream: number) => {
      const current = modeRef.current;
      const from = now();
      if (current.kind === 'stream') switchTo({ ...current, from, audio: stream });
      else switchTo({ kind: 'stream', video: 'copy', from, audio: stream, reason: 'audio' });
    },
    [now, switchTo],
  );

  const duration = mode.kind === 'stream' ? (media?.duration ?? 0) : player.duration || loadedDuration;

  return { mode, now, duration, seek, chooseAudio, base };
}
