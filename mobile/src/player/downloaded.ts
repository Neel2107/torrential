import { useEffect, useMemo, useState } from 'react';

import { arrived } from '@web/lib/pieces';
import { PIECE_RUNS, type FilePieces, type Job, type StreamedFile } from '@web/wire';

import { get } from '@/engine/client';
import { useJobs } from '@/engine/jobs';
import { useLink } from '@/engine/session';

export type Downloaded = number[];

export type Run = { from: number; to: number; share: number };

const POLL_MS = 3000;
const WHOLE: Downloaded = Array.from({ length: PIECE_RUNS }, () => 1);

function fromTorrentMap(job: Job, file: StreamedFile, totalSize: number): Downloaded {
  const runs = arrived(job, file, totalSize);
  return Array.from({ length: PIECE_RUNS }, (_, i) => {
    const middle = (i + 0.5) / PIECE_RUNS;
    return runs.find((run) => run.from <= middle && middle < run.to)?.share ?? 0;
  });
}

export function usePlayingJob(job: Job): Job {
  const { jobs } = useJobs();
  return jobs.find((candidate) => candidate.id === job.id) ?? job;
}

export function useDownloaded(job: Job, file: StreamedFile, totalSize: number): Downloaded {
  const link = useLink();
  const [own, setOwn] = useState<Downloaded | null>(null);
  const done = job.state === 'done';
  const { id } = job;

  useEffect(() => {
    if (done) return;
    const stop = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = () =>
      get<FilePieces>(link, `/api/pieces?id=${id}&file=${file.index}`, stop.signal)
        .then((map) => setOwn([...map.pieces].map((eighths) => (Number(eighths) || 0) / 8)))
        .catch(() => !stop.signal.aborted && setOwn(null))
        .finally(() => {
          if (!stop.signal.aborted) timer = setTimeout(poll, POLL_MS);
        });
    poll();
    return () => {
      stop.abort();
      clearTimeout(timer);
    };
  }, [link, id, file.index, done]);

  const coarse = useMemo(
    () => (own || done ? null : fromTorrentMap(job, file, totalSize)),
    [own, done, job, file, totalSize],
  );
  return done ? WHOLE : (own ?? coarse ?? WHOLE);
}

export function runsOf(downloaded: Downloaded): Run[] {
  const runs: Run[] = [];
  const step = 1 / downloaded.length;
  downloaded.forEach((share, i) => {
    if (share <= 0) return;
    const last = runs.at(-1);
    if (last && last.share === share && Math.abs(last.to - i * step) < 1e-9) last.to = (i + 1) * step;
    else runs.push({ from: i * step, to: (i + 1) * step, share });
  });
  return runs;
}
