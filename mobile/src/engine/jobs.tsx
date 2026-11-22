import { router } from 'expo-router';
import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { readable } from '@web/lib/release';
import type { Event, Job } from '@web/wire';

import { events } from './client';
import { useTitle } from './queries';
import { useLink } from './session';

const SILENT_MS = 35_000;

type Jobs = { jobs: Job[]; live: boolean };

type State = { jobs: Map<string, Job>; live: boolean };

type Store = {
  get: () => Jobs;
  subscribe: (listener: () => void) => () => void;
  update: (change: (previous: State) => State) => void;
};

function createStore(): Store {
  let state: State = { jobs: new Map(), live: false };
  let view: Jobs = { jobs: [], live: false };
  const listeners = new Set<() => void>();

  return {
    get: () => view,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    update: (change) => {
      const next = change(state);

      if (next === state) return;
      state = next;
      view = { jobs: [...next.jobs.values()].sort((a, b) => b.added_at - a.added_at), live: next.live };

      for (const listener of listeners) listener();
    },
  };
}

const Context = createContext<Store | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const link = useLink();
  const [store] = useState(createStore);
  const setState = store.update;

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
      generation += 1;
      const mine = generation;

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

  return <Context value={store}>{children}</Context>;
}

function useStore(): Store {
  const store = use(Context);

  if (!store) throw new Error('jobs read outside JobsProvider');

  return store;
}

export function useJobs(): Jobs {
  const store = useStore();

  return useSyncExternalStore(store.subscribe, store.get);
}

/** A slice of the jobs that re-renders only when `same` says it changed, so progress ticks skip readers that do not show them. */
export function useJobsSelect<T>(select: (jobs: Jobs) => T, same: (a: T, b: T) => boolean = Object.is): T {
  const store = useStore();
  const last = useRef<{ value: T } | null>(null);

  const read = () => {
    const next = select(store.get());

    if (last.current && same(last.current.value, next)) return last.current.value;
    last.current = { value: next };

    return next;
  };

  return useSyncExternalStore(store.subscribe, read);
}

export function useJob(id: string): Job | undefined {
  return useJobsSelect((all) => all.jobs.find((job) => job.id === id));
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

const EPISODE = /s(\d{1,2})[ ._-]*e(\d{1,3})|\b(\d{1,2})x(\d{2,3})\b/i;

/** The episode numbers a season download picked, or null when it picked them all or its names do not say. */
export function pickedEpisodes(job: Job): number[] | null {
  if (job.selection.kind !== 'patterns') return null;

  const numbers = [
    ...new Set(
      job.selection.value
        .map((name) => EPISODE.exec(name))
        .filter((found) => found !== null)
        .map((found) => Number(found[2] ?? found[4])),
    ),
  ].sort((a, b) => a - b);

  return numbers.length > 0 ? numbers : null;
}

function episodesOf(job: Job): string | null {
  if (job.title && /e\d/i.test(job.title.span)) return null;
  const names = job.selection.kind === 'patterns' ? job.selection.value : job.path ? [job.path] : [];

  const numbers = [
    ...new Set(
      names
        .map((name) => EPISODE.exec(name))
        .filter((found) => found !== null)
        .map((found) => Number(found[2] ?? found[4])),
    ),
  ].sort((a, b) => a - b);

  if (numbers.length === 0) return null;

  if (numbers.length === 1) return `E${numbers[0]}`;

  return `${numbers.length} episodes`;
}

export function useJobName(job: Job) {
  const page = useTitle(job.title?.title ?? '', Boolean(job.title));
  const fromName = readable(job.name ?? job.id);

  if (job.title && page.data) {
    const span =
      job.title.span === 'film'
        ? page.data.year
          ? String(page.data.year)
          : ''
        : [job.title.span.toUpperCase(), episodesOf(job)].filter(Boolean).join(' ');

    return { title: page.data.name, tags: span, poster: job.title.title };
  }

  return { ...fromName, poster: null };
}

export function openJob(job: Job) {
  if (job.title) router.push({ pathname: '/title/[id]', params: { id: job.title.title } });
  else router.push({ pathname: '/play', params: { ref: job.id } });
}
