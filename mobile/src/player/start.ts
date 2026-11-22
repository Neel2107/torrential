import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';

import type {
  AttemptEvent,
  Check,
  EpisodeInfo,
  Error as WireError,
  PlayInfo,
  PlayingLine,
  PlayTitle,
  Release,
  TitleCard,
  Viewer,
} from '@web/wire';

import { EngineError, post, stream, type Link } from '@/engine/client';
import { useDataSaver } from '@/engine/dataSaver';
import { useLink } from '@/engine/session';
import { lap } from '@/perf';

/** A line of `POST /api/title/play`: an attempt's events, with the playing line in place of the engine's own. */
export type PlayMessage = Exclude<AttemptEvent, { type: 'playing' }> | PlayingLine;

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

const SAVER_WIDTH = 1280;
const SAVER_HEIGHT = 720;

/** The screen and decoders the engine ranks sources for. On mobile data with the data saver on, it says 720p, so smaller sources lead. */
export function useViewer(): Viewer {
  const { width, height } = useWindowDimensions();
  const scale = PixelRatio.get();
  const network = Network.useNetworkState();
  const [saver] = useDataSaver();
  const small = saver && network.type === Network.NetworkStateType.CELLULAR;
  const long = Math.round(Math.max(width, height) * scale);
  const short = Math.round(Math.min(width, height) * scale);

  return {
    width: small ? Math.min(long, SAVER_WIDTH) : long,
    height: small ? Math.min(short, SAVER_HEIGHT) : short,
    scale,
    playback: 'hevc',
    decoders: { h264: 'hardware', hevc: 'hardware', av1: 'no' },
  };
}

export type Replacement = { play: PlayInfo; release: Release } | { error: WireError };

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

/** What starting a title has heard so far: the phase to show, the title and episode it resolved to, how many sources it found, and whether it ended. */
export type Starting = {
  start: Start;
  title: TitleCard | null;
  episode: EpisodeInfo | null;
  found: number;
  ended: boolean;
};

export const STARTING: Starting = {
  start: { phase: 'finding', title: null, episode: null },
  title: null,
  episode: null,
  found: 0,
  ended: false,
};

/** Where starting a title stands after `message`. */
export function heard(state: Starting, message: PlayMessage): Starting {
  const { title, episode, found } = state;

  switch (message.type) {
    case 'resolved':
      return {
        ...state,
        title: message.title,
        episode: message.episode,
        start: { phase: 'finding', title: message.title, episode: message.episode },
      };
    case 'searched':
      return { ...state, found: message.found };
    case 'trying':
      return {
        ...state,
        start: {
          phase: 'trying',
          title,
          episode,
          rank: message.rank,
          of: message.of,
          release: message.release,
          check: null,
          found,
        },
      };
    case 'check':
      return state.start.phase === 'trying' ? { ...state, start: { ...state.start, check: message.check } } : state;
    case 'skipped':
      return state;
    case 'playing':
      return {
        ...state,
        ended: true,
        start: {
          phase: 'ready',
          title,
          episode,
          release: message.release,
          play: message.play,
          resumeAt: message.resume_at,
        },
      };
    case 'failed':
      return {
        ...state,
        ended: true,
        start: {
          phase: 'failed',
          title,
          episode,
          message: message.error.message,
          hint: message.error.hint ?? null,
          tried: message.tried.length,
        },
      };
  }
}

function failedWith(state: Starting, message: string, hint: string | null): Start {
  return { phase: 'failed', title: state.title, episode: state.episode, message, hint, tried: 0 };
}

/** Starts a title as `body` asks and shows each phase it reaches. A stream that ends before a source plays, or a lost engine, shows as failed; nothing shows once `signal` aborts. */
export async function followPlay(
  link: Link,
  body: PlayTitle,
  signal: AbortSignal,
  show: (start: Start) => void,
): Promise<void> {
  let state = STARTING;

  try {
    await stream<PlayMessage>(link, '/api/title/play', { method: 'POST', body, signal }, (message) => {
      lap('play', `play ${message.type}`);
      const next = heard(state, message);

      if (next.start !== state.start) show(next.start);
      state = next;
    });
  } catch (cause) {
    if (signal.aborted) return;
    const engine = cause instanceof EngineError;

    show(
      failedWith(
        state,
        engine ? cause.message : 'Lost the engine while starting the video.',
        engine ? cause.hint : null,
      ),
    );

    return;
  }

  if (state.ended || signal.aborted) return;
  show(failedWith(state, 'The engine stopped answering before a source played.', null));
}

export function useTitlePlay(video: string, attempt: number, source?: string): Start {
  const link = useLink();
  const viewer = useViewer();
  const [start, setStart] = useState<Start>(STARTING.start);

  useEffect(() => {
    const controller = new AbortController();
    setStart(STARTING.start);
    const body: PlayTitle = source ? { video, viewer, source } : { video, viewer };
    followPlay(link, body, controller.signal, setStart);

    return () => controller.abort();
  }, [link, video, attempt, source]);

  return start;
}

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
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setStart({
          phase: 'failed',
          title: null,
          episode: null,
          message: cause instanceof EngineError ? cause.message : 'Lost the engine while starting the torrent.',
          hint: cause instanceof EngineError ? cause.hint : null,
          tried: 0,
        });
      },
    );

    return () => controller.abort();
  }, [link, ref, attempt, file]);

  return start;
}
