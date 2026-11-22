import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { titleOf } from '@web/lib/video';
import type { PlayTitle, Viewer } from '@web/wire';

import { pickedEpisodes, useJobsSelect } from '@/engine/jobs';
import { copyOf, save, type Label } from '@/offline/saved';
import type { PlayMessage } from '@/player/start';
import { useViewer } from '@/player/start';

import { post, stream, type Link } from './client';
import { keys } from './queries';
import { useLink, useSession } from './session';

export type Fetching =
  { state: 'idle' } | { state: 'finding' } | { state: 'started'; job: string } | { state: 'failed'; message: string };

const wanted = new File(Paths.document, 'save-when-done.json');

type Wanted = Record<string, { label: Label; file: number }>;

let asked = 0;
const askedListeners = new Set<() => void>();

function readWanted(): Wanted {
  try {
    return wanted.exists ? (JSON.parse(wanted.textSync()) as Wanted) : {};
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

/** Starts a download of `video` the way Play would, without opening the player: it answers once a source holds. */
export async function startDownload(link: Link, viewer: Viewer, video: string): Promise<{ job: string; file: number }> {
  const body: PlayTitle = { video, viewer };
  let job: { job: string; file: number } | null = null;
  let failure: string | null = null;
  const controller = new AbortController();
  await stream<PlayMessage>(link, '/api/title/play', { method: 'POST', body, signal: controller.signal }, (message) => {
    if (message.type === 'playing') {
      job = { job: message.play.id, file: message.play.video.index };
      controller.abort();
    }
    if (message.type === 'failed') failure = message.error.message;
  }).catch((error: unknown) => {
    if (!job) failure = error instanceof Error ? error.message : 'Lost the engine while finding a source.';
  });
  if (job) return job;
  throw new Error(failure ?? 'No source started.');
}

/** How far a download covering `video` has come: the film, the episode, or the season it is in. */
export function useHeldState(video: string | null): 'none' | 'downloading' | 'done' {
  const [title, season, episode] = (video ?? '').split(':');
  const spans = season ? [`s${Number(season)}e${Number(episode)}`, `s${Number(season)}`] : ['film'];
  return useJobsSelect(({ jobs }) => {
    if (!video) return 'none';
    const covering = jobs.filter((job) => {
      if (job.title?.title !== title || !spans.includes(job.title.span.toLowerCase())) return false;
      if (!season || /e\d/i.test(job.title.span)) return true;
      const picked = pickedEpisodes(job);
      return picked === null || picked.includes(Number(episode));
    });
    if (covering.some((job) => job.state === 'done')) return 'done';
    return covering.some((job) => job.state !== 'paused' && job.state !== 'error') ? 'downloading' : 'none';
  });
}

/** Whether a download already covers `video`. */
export function useHeld(video: string | null): boolean {
  return useHeldState(video) !== 'none';
}

/** A Download button's state for `video`, and the press that starts it. The press saves the title first, so the engine keeps the download rather than pausing it as an idle play; on a computer's engine the copy comes to this phone once it finishes. */
export function useDownload(video: string | null, label: Label) {
  const link = useLink();
  const viewer = useViewer();
  const { session } = useSession();
  const onComputer = session.state === 'paired' && session.engine.kind !== 'phone';
  const [fetching, setFetching] = useState<Fetching>({ state: 'idle' });
  const client = useQueryClient();

  useEffect(() => setFetching({ state: 'idle' }), [video]);

  const start = async () => {
    if (!video || fetching.state === 'finding') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFetching({ state: 'finding' });
    try {
      const title = titleOf(video);
      await post(link, '/api/library', { title, saved: true });
      client.invalidateQueries({ queryKey: keys.title(title) });
      client.invalidateQueries({ queryKey: keys.home });
      const started = await startDownload(link, viewer, video);
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
