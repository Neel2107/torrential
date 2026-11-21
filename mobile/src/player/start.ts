import { useEffect, useState } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

import type {
  Check,
  EpisodeInfo,
  Error as WireError,
  PlayInfo,
  PlayTitle,
  Release,
  TitleCard,
  Tried,
  Viewer,
} from '@web/wire';

import { EngineError, post, stream, type Link } from '@/engine/client';
import { useLink } from '@/engine/session';

type PlayMessage =
  | { type: 'resolved'; video: string; title: TitleCard; episode: EpisodeInfo | null }
  | { type: 'searched'; found: number }
  | { type: 'trying'; rank: number; of: number; release: Release }
  | { type: 'check'; check: Check }
  | { type: 'skipped'; release: string }
  | { type: 'failed'; error: WireError; tried: Tried[] }
  | { type: 'playing'; video: string; release: Release; play: PlayInfo; resume_at: number | null };

/** What starting a play looks like from the phone, one step at a time. */
export type Start =
  | { phase: 'finding'; title: TitleCard | null; episode: EpisodeInfo | null }
  | {
      phase: 'trying';
      title: TitleCard | null;
      episode: EpisodeInfo | null;
      rank: number;
      of: number;
      release: Release;
      check: Check | null;
      found: number;
    }
  | {
      phase: 'ready';
      title: TitleCard | null;
      episode: EpisodeInfo | null;
      release: Release;
      play: PlayInfo;
      resumeAt: number | null;
    }
  | {
      phase: 'failed';
      title: TitleCard | null;
      episode: EpisodeInfo | null;
      message: string;
      hint: string | null;
      tried: number;
    };

/**
 * The phone's screen and decoders, so the engine ranks sources for what this phone plays well. Phones
 * this app supports decode H.264 and HEVC in hardware.
 */
export function useViewer(): Viewer {
  const { width, height } = useWindowDimensions();
  const scale = PixelRatio.get();
  return {
    width: Math.round(Math.max(width, height) * scale),
    height: Math.round(Math.min(width, height) * scale),
    scale,
    playback: 'hevc',
    decoders: { h264: 'hardware', hevc: 'hardware', av1: 'no' },
  };
}

/** A source that took over from one that stalled, or why none could. */
export type Replacement = { play: PlayInfo; release: Release } | { error: WireError };

/**
 * Asks the engine for another source of `video` in place of the download `stalled`, which the
 * engine pauses once the new one plays. Reads the stream to its end, since the engine treats a
 * caller that goes away early as one that no longer wants the source it is trying.
 */
export async function replaceStalled(
  link: Link,
  request: { video: string; stalled: string; viewer: Viewer },
  signal: AbortSignal,
): Promise<Replacement> {
  const body: PlayTitle = { video: request.video, viewer: request.viewer, replace: request.stalled };
  let outcome: Replacement | null = null;
  try {
    await stream<PlayMessage>(link, '/api/title/play', { method: 'POST', body, signal }, (message) => {
      if (message.type === 'playing') outcome = { play: message.play, release: message.release };
      if (message.type === 'failed') outcome = { error: message.error };
    });
  } catch (error) {
    if (signal.aborted) throw error;
    const message = error instanceof EngineError ? error.message : 'Lost the engine while looking for another source.';
    return outcome ?? { error: { code: 'interrupted', message } };
  }
  return outcome ?? { error: { code: 'interrupted', message: 'The engine stopped answering before a source played.' } };
}

/** Asks the engine to find and start a source for `video`, following each step it reports. */
export function useTitlePlay(video: string, attempt: number, source?: string): Start {
  const link = useLink();
  const viewer = useViewer();
  const [start, setStart] = useState<Start>({ phase: 'finding', title: null, episode: null });

  useEffect(() => {
    const controller = new AbortController();
    let title: TitleCard | null = null;
    let episode: EpisodeInfo | null = null;
    let found = 0;
    let ended = false;
    setStart({ phase: 'finding', title, episode });

    const body: PlayTitle = source ? { video, viewer, source } : { video, viewer };
    stream<PlayMessage>(link, '/api/title/play', { method: 'POST', body, signal: controller.signal }, (message) => {
      switch (message.type) {
        case 'resolved':
          title = message.title;
          episode = message.episode;
          setStart({ phase: 'finding', title, episode });
          break;
        case 'searched':
          found = message.found;
          break;
        case 'trying':
          setStart({
            phase: 'trying',
            title,
            episode,
            rank: message.rank,
            of: message.of,
            release: message.release,
            check: null,
            found,
          });
          break;
        case 'check':
          setStart((previous) => (previous.phase === 'trying' ? { ...previous, check: message.check } : previous));
          break;
        case 'playing':
          ended = true;
          setStart({
            phase: 'ready',
            title,
            episode,
            release: message.release,
            play: message.play,
            resumeAt: message.resume_at,
          });
          break;
        case 'failed':
          ended = true;
          setStart({
            phase: 'failed',
            title,
            episode,
            message: message.error.message,
            hint: message.error.hint ?? null,
            tried: message.tried.length,
          });
          break;
      }
    })
      .then(() => {
        // The engine closed the answer without saying how it ended: it stopped or restarted.
        if (ended || controller.signal.aborted) return;
        setStart({
          phase: 'failed',
          title,
          episode,
          message: 'The engine stopped answering before a source played.',
          hint: null,
          tried: 0,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const engine = error instanceof EngineError;
        setStart({
          phase: 'failed',
          title,
          episode,
          message: engine ? error.message : 'Lost the engine while starting the video.',
          hint: engine ? error.hint : null,
          tried: 0,
        });
      });

    return () => controller.abort();
    // The viewer is read once per attempt; rotating the phone mid-start should not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, video, attempt, source]);

  return start;
}

/**
 * Starts a torrent picked by hand: a search result, or a magnet link shared from another app. The
 * engine waits up to a minute for a magnet's file list, then answers with `file`, or the file it
 * would play.
 */
export function useTorrentPlay(ref: string, attempt: number, file?: number): Start {
  const link = useLink();
  const [start, setStart] = useState<Start>({ phase: 'finding', title: null, episode: null });

  useEffect(() => {
    const controller = new AbortController();
    setStart({ phase: 'finding', title: null, episode: null });
    post<PlayInfo>(link, '/api/play', file === undefined ? { ref } : { ref, file }, controller.signal).then(
      (play) => {
        const release: Release = {
          id: play.id,
          name: play.name,
          size: play.total_size,
          seeders: null,
          leechers: null,
          published: null,
          category: 'video',
          quality: { resolution: null, codec: null, hdr: false },
          flags: [],
          sources: [],
          magnet: null,
          torrent_url: null,
          info_url: null,
        };
        setStart({ phase: 'ready', title: null, episode: null, release, play, resumeAt: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setStart({
          phase: 'failed',
          title: null,
          episode: null,
          message: error instanceof EngineError ? error.message : 'Lost the engine while starting the torrent.',
          hint: error instanceof EngineError ? error.hint : null,
          tried: 0,
        });
      },
    );
    return () => controller.abort();
  }, [link, ref, attempt, file]);

  return start;
}
