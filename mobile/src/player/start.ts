import { useEffect, useState } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

import type { Check, EpisodeInfo, Error as WireError, PlayInfo, PlayTitle, Release, TitleCard, Tried, Viewer } from '@web/wire';

import { EngineError, post, stream } from '@/engine/client';
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
  | { phase: 'trying'; title: TitleCard | null; episode: EpisodeInfo | null; rank: number; of: number; release: Release; check: Check | null; found: number }
  | { phase: 'ready'; title: TitleCard | null; episode: EpisodeInfo | null; release: Release; play: PlayInfo; resumeAt: number | null }
  | { phase: 'failed'; title: TitleCard | null; episode: EpisodeInfo | null; message: string; hint: string | null; tried: number };

/**
 * The phone's screen and decoders, so the engine ranks sources for what this phone plays well. Phones
 * this app supports decode H.264 and HEVC in hardware.
 */
function useViewer(): Viewer {
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

/** Asks the engine to find and start a source for `video`, following each step it reports. */
export function useTitlePlay(video: string, attempt: number): Start {
  const link = useLink();
  const viewer = useViewer();
  const [start, setStart] = useState<Start>({ phase: 'finding', title: null, episode: null });

  useEffect(() => {
    const controller = new AbortController();
    let title: TitleCard | null = null;
    let episode: EpisodeInfo | null = null;
    let found = 0;
    setStart({ phase: 'finding', title, episode });

    const body: PlayTitle = { video, viewer };
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
          setStart({ phase: 'trying', title, episode, rank: message.rank, of: message.of, release: message.release, check: null, found });
          break;
        case 'check':
          setStart((previous) => (previous.phase === 'trying' ? { ...previous, check: message.check } : previous));
          break;
        case 'playing':
          setStart({ phase: 'ready', title, episode, release: message.release, play: message.play, resumeAt: message.resume_at });
          break;
        case 'failed':
          setStart({ phase: 'failed', title, episode, message: message.error.message, hint: message.error.hint ?? null, tried: message.tried.length });
          break;
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const engine = error instanceof EngineError;
      setStart({
        phase: 'failed',
        title,
        episode,
        message: engine ? error.message : "Lost the engine while starting the video.",
        hint: engine ? error.hint : null,
        tried: 0,
      });
    });

    return () => controller.abort();
    // The viewer is read once per attempt; rotating the phone mid-start should not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, video, attempt]);

  return start;
}

/**
 * Starts a torrent picked by hand: a search result, or a magnet link shared from another app. The
 * engine waits up to a minute for a magnet's file list, then answers with the file to play.
 */
export function useTorrentPlay(ref: string, attempt: number): Start {
  const link = useLink();
  const [start, setStart] = useState<Start>({ phase: 'finding', title: null, episode: null });

  useEffect(() => {
    const controller = new AbortController();
    setStart({ phase: 'finding', title: null, episode: null });
    post<PlayInfo>(link, '/api/play', { ref }, controller.signal).then(
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
  }, [link, ref, attempt]);

  return start;
}
