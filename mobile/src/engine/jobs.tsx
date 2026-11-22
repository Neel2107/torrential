import { router } from 'expo-router';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { readable } from '@web/lib/release';
import type { Event, Job } from '@web/wire';

import { events } from './client';
import { useTitle } from './queries';
import { useLink } from './session';

const SILENT_MS = 35_000;

type Jobs = { jobs: Job[]; live: boolean };

const Context = createContext<Jobs | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const link = useLink();
  const [state, setState] = useState<{ jobs: Map<string, Job>; live: boolean }>({ jobs: new Map(), live: false });

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let attempt = 0;
    let generation = 0;
    let heard = Date.now();

    const apply = (event: Event) => {
      heard = Date.now();
      attempt = 0;
      setState((previous) => {
        if (event.event === 'snapshot') return { jobs: new Map(event.jobs.map((job) => [job.id, job])), live: true };
        if (event.event === 'job') return { jobs: new Map(previous.jobs).set(event.job.id, event.job), live: true };
        if (event.event === 'removed') {
          const jobs = new Map(previous.jobs);
          jobs.delete(event.id);
          return { jobs, live: true };
        }
        return previous.live ? previous : { ...previous, live: true };
      });
    };

    const open = async () => {
      const mine = ++generation;
      while (!stopped && mine === generation && AppState.currentState === 'active') {
        controller = new AbortController();
        heard = Date.now();
        try {
          await events<Event>(link, '/api/events', controller.signal, apply);
        } catch {}
        if (stopped || mine !== generation) return;
        setState((previous) => ({ ...previous, live: false }));
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)));
      }
    };

    const watchdog = setInterval(() => {
      if (Date.now() - heard > SILENT_MS) controller?.abort();
    }, 5_000);

    open();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        attempt = 0;
        controller?.abort();
        if (!stopped) open();
      } else {
        generation += 1;
        controller?.abort();
      }
    });
    return () => {
      stopped = true;
      clearInterval(watchdog);
      controller?.abort();
      subscription.remove();
    };
  }, [link]);

  const value = useMemo(
    () => ({ jobs: [...state.jobs.values()].sort((a, b) => b.added_at - a.added_at), live: state.live }),
    [state],
  );
  return <Context value={value}>{children}</Context>;
}

export function useJobs(): Jobs {
  const jobs = use(Context);
  if (!jobs) throw new Error('useJobs outside JobsProvider');
  return jobs;
}

export const STATE: Record<Job['state'], string> = {
  queued: 'Queued',
  metadata: 'Getting files',
  checking: 'Checking',
  downloading: 'Downloading',
  paused: 'Paused',
  done: 'Done',
  error: 'Failed',
};

export function useJobName(job: Job): { title: string; tags: string; poster: string | null } {
  const page = useTitle(job.title?.title ?? '', Boolean(job.title));
  const fromName = readable(job.name ?? job.id);
  if (job.title && page.data) {
    const span =
      job.title.span === 'film' ? (page.data.year ? String(page.data.year) : '') : job.title.span.toUpperCase();
    return { title: page.data.name, tags: span, poster: job.title.title };
  }
  return { ...fromName, poster: null };
}

export function openJob(job: Job) {
  if (job.title) router.push({ pathname: '/title/[id]', params: { id: job.title.title } });
  else router.push({ pathname: '/play', params: { ref: job.id } });
}
