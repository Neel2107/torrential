import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { titleOf } from '@web/lib/video';
import type { PlayTitle, Viewer } from '@web/wire';

import { useJobsSelect } from '@/engine/jobs';
import { save, type Label } from '@/offline/saved';
import type { PlayMessage } from '@/player/start';
import { useViewer } from '@/player/start';

import { post, stream, type Link } from './client';
import { keys } from './queries';
import { useLink, useSession } from './session';

export type Fetching =
  { state: 'idle' } | { state: 'finding' } | { state: 'started'; job: string } | { state: 'failed'; message: string };

const wanted = new File(Paths.document, 'save-when-done.json');

function readWanted(): Record<string, Label> {
  try {
    return wanted.exists ? (JSON.parse(wanted.textSync()) as Record<string, Label>) : {};
  } catch {
    return {};
  }
}

function writeWanted(jobs: Record<string, Label>) {
  try {
    if (Object.keys(jobs).length === 0) {
      if (wanted.exists) wanted.delete();
      return;
    }
    wanted.write(JSON.stringify(jobs));
  } catch {}
}

/** Starts a download of `video` the way Play would, without opening the player: it answers once a source holds. */
export async function startDownload(link: Link, viewer: Viewer, video: string): Promise<string> {
  const body: PlayTitle = { video, viewer };
  let job: string | null = null;
  let failure: string | null = null;
  const controller = new AbortController();
  await stream<PlayMessage>(link, '/api/title/play', { method: 'POST', body, signal: controller.signal }, (message) => {
    if (message.type === 'playing') {
      job = message.play.id;
      controller.abort();
    }
    if (message.type === 'failed') failure = message.error.message;
  }).catch((error: unknown) => {
    if (!job) failure = error instanceof Error ? error.message : 'Lost the engine while finding a source.';
  });
  if (job) return job;
  throw new Error(failure ?? 'No source started.');
}

/** A Download button's state for `video`, and the press that starts it. The press saves the title first, so the engine keeps the download rather than pausing it as an idle play; on a computer's engine the copy comes to this phone once it finishes. */
/** Whether a download already covers `video`: the film, the episode, or the season it is in. */
export function useHeld(video: string | null): boolean {
  const [title, season, episode] = (video ?? '').split(':');
  const spans = season ? [`s${Number(season)}e${Number(episode)}`, `s${Number(season)}`] : ['film'];
  return useJobsSelect(
    ({ jobs }) =>
      Boolean(video) && jobs.some((job) => job.title?.title === title && spans.includes(job.title.span.toLowerCase())),
  );
}

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
      const job = await startDownload(link, viewer, video);
      if (onComputer) writeWanted({ ...readWanted(), [job]: label });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFetching({ state: 'started', job });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFetching({ state: 'failed', message: error instanceof Error ? error.message : 'No source started.' });
    }
  };

  return { fetching, start, onComputer };
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Saves to this phone the computer's downloads that were asked for that way, as each finishes. */
export function SaveWhenDone() {
  const link = useLink();
  const done = useJobsSelect(({ jobs }) => jobs.filter((job) => job.state === 'done').map((job) => job.id), sameIds);

  useEffect(() => {
    const asked = readWanted();
    const ready = done.filter((id) => asked[id]);
    if (ready.length === 0) return;
    for (const id of ready) {
      save(link, id, asked[id]);
      delete asked[id];
    }
    writeWanted(asked);
  }, [done, link]);

  return null;
}
