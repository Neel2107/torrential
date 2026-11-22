import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Job, PlayTitle, Viewer } from '@web/wire';

import { pickedVideos, useJobsSelect } from '@/engine/jobs';
import { copyOf, save, type Label } from '@/offline/saved';
import type { PlayMessage } from '@/player/start';
import { useViewer } from '@/player/start';

import { stream, type Link } from './client';
import { useLink, useSession } from './session';
import { covers, parseSpan, parseVideo } from './span';
import { readStored, wantedCopies } from './stored';

export type Fetching =
  { state: 'idle' } | { state: 'finding' } | { state: 'started'; job: string } | { state: 'failed'; message: string };

const wanted = new File(Paths.document, 'save-when-done.json');

type Wanted = Record<string, { label: Label; file: number }>;

let asked = 0;
const askedListeners = new Set<() => void>();

function readWanted(): Wanted {
  try {
    return readStored(wantedCopies, wanted.exists ? wanted.textSync() : null, {});
  } catch {
    return {};
  }
}

function writeWanted(jobs: Wanted) {
  try {
    if (Object.keys(jobs).length === 0) {
      if (wanted.exists) wanted.delete();

      return;
    }

    wanted.writeSync(JSON.stringify(jobs));
  } catch {}

  asked += 1;

  for (const listener of askedListeners) listener();
}

/** Starts a download of `video` to keep, finding its source the way Play would, without opening the player: it answers once a source holds. */
export async function startDownload(
  link: Link,
  viewer: Viewer,
  video: string,
  source?: string,
): Promise<{ job: string; file: number }> {
  const body: PlayTitle = source ? { video, viewer, source, keep: true } : { video, viewer, keep: true };
  let job: { job: string; file: number } | null = null;
  let failure: string | null = null;
  const controller = new AbortController();
  await stream<PlayMessage>(link, '/api/title/play', { method: 'POST', body, signal: controller.signal }, (message) => {
    if (message.type === 'playing') {
      job = { job: message.play.id, file: message.play.video.index };
      controller.abort();
    }

    if (message.type === 'failed') failure = message.error.message;
  }).catch((cause: unknown) => {
    if (!job) failure = cause instanceof Error ? cause.message : 'Lost the engine while finding a source.';
  });

  if (job) return job;
  throw new Error(failure ?? 'No source started.');
}

export type Held = { state: 'none' | 'downloading' | 'done'; fraction: number };

const NONE: Held = { state: 'none', fraction: 0 };

const sameHeld = (a: Held, b: Held) =>
  a.state === b.state && Math.round(a.fraction * 200) === Math.round(b.fraction * 200);

/** How far the downloads in `jobs` that cover `video` have come; the one `prefer` names counts first. */
export function held(jobs: Job[], video: string | null, prefer?: string): Held {
  if (!video) return NONE;
  const { title, episode } = parseVideo(video);

  const covering = jobs.filter((job) => {
    const span = job.title?.title === title ? parseSpan(job.title.span) : null;

    if (!span || !covers(span, episode)) return false;

    if (!episode || span.kind === 'episode') return true;
    const picked = pickedVideos(job);

    return picked === null || picked.some((one) => one.season === episode.season && one.episode === episode.episode);
  });

  if (covering.some((job) => job.state === 'done')) return { state: 'done', fraction: 1 };
  const moving = covering.filter((job) => job.state !== 'paused' && job.state !== 'error');

  if (moving.length === 0) return NONE;
  const mine = moving.find((job) => job.id === prefer);

  if (mine)
    return { state: 'downloading', fraction: mine.progress.size ? mine.progress.verified / mine.progress.size : 0 };

  const fraction = Math.max(
    ...moving.map((job) => (job.progress.size ? job.progress.verified / job.progress.size : 0)),
  );

  return { state: 'downloading', fraction };
}

/** How far a download covering `video` has come: the film, the episode, or the season it is in. */
export function useHeldState(video: string | null): Held['state'] {
  return useJobsSelect(({ jobs }) => held(jobs, video).state);
}

/** The same, with how much of it has arrived, changing in half-percent steps; the download `prefer` names counts first. */
export function useHeldProgress(video: string | null, prefer?: string): Held {
  return useJobsSelect(({ jobs }) => held(jobs, video, prefer), sameHeld);
}

/** Whether a download already covers `video`. */
export function useHeld(video: string | null): boolean {
  return useHeldState(video) !== 'none';
}

/** A Download button's state for `video`, and the press that starts it. The download is one to keep, so the engine never pauses it for lying unwatched; on a computer's engine the copy comes to this phone once it finishes. */
export function useDownload(video: string | null, label: Label) {
  const link = useLink();
  const viewer = useViewer();
  const { session } = useSession();
  const onComputer = session.state === 'paired' && session.engine.kind !== 'phone';
  const [fetching, setFetching] = useState<Fetching>({ state: 'idle' });

  useEffect(() => setFetching({ state: 'idle' }), [video]);

  const start = async (source?: string) => {
    if (!video || fetching.state === 'finding') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFetching({ state: 'finding' });

    try {
      const started = await startDownload(link, viewer, video, source);

      if (onComputer) writeWanted({ ...readWanted(), [started.job]: { label, file: started.file } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFetching({ state: 'started', job: started.job });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFetching({ state: 'failed', message: error instanceof Error ? error.message : 'No source started.' });
    }
  };

  return { fetching, start, onComputer };
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

const subscribeAsked = (listener: () => void) => {
  askedListeners.add(listener);

  return () => askedListeners.delete(listener);
};

/** Saves to this phone the computer's downloads that were asked for that way, as each finishes, and forgets the ask once the copy is saved. */
export function SaveWhenDone() {
  const link = useLink();
  const done = useJobsSelect(({ jobs }) => jobs.filter((job) => job.state === 'done').map((job) => job.id), sameIds);
  const version = useSyncExternalStore(subscribeAsked, () => asked);

  useEffect(() => {
    const wanting = readWanted();

    for (const id of done.filter((candidate) => wanting[candidate])) {
      const { label, file } = wanting[id];
      save(link, id, label, file).then(() => {
        if (copyOf(id)?.state !== 'saved') return;
        const left = readWanted();
        delete left[id];
        writeWanted(left);
      });
    }
  }, [done, link, version]);

  return null;
}
