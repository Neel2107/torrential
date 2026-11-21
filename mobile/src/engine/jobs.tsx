import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Event, Job } from '@web/wire';

import { events } from './client';
import { useLink } from './session';

/** The engine sends a heartbeat after 15 s of quiet; a stream silent for longer than this is dead. */
const SILENT_MS = 35_000;

type Jobs = { jobs: Job[]; live: boolean };

const Context = createContext<Jobs | null>(null);

/**
 * Every download, live, on one stream for the whole app. The engine sends a snapshot and then each
 * change. The stream is held only in the foreground, reopens with backoff when it drops, and is torn
 * down and reopened when it goes silent, which a half-open connection after a network change does.
 */
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
