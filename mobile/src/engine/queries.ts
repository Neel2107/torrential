import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { Event, Home, Job, Me, TitlePage, TitleSearch, TvList, Version } from '@web/wire';

import { events, get, post, type Link } from './client';
import { useLink } from './session';

export const keys = {
  home: ['home'] as const,
  title: (id: string) => ['title', id] as const,
  titles: (q: string) => ['titles', q] as const,
  me: ['me'] as const,
  version: ['version'] as const,
  tvs: ['tvs'] as const,
};

export function useHome() {
  const link = useLink();
  return useQuery({ queryKey: keys.home, queryFn: ({ signal }) => get<Home>(link, '/api/home', signal) });
}

export function useTitle(id: string) {
  const link = useLink();
  return useQuery({
    queryKey: keys.title(id),
    queryFn: ({ signal }) => get<TitlePage>(link, `/api/title?id=${encodeURIComponent(id)}`, signal),
  });
}

export function useTitleSearch(q: string) {
  const link = useLink();
  const query = q.trim();
  return useQuery({
    queryKey: keys.titles(query),
    queryFn: ({ signal }) => get<TitleSearch>(link, `/api/titles?q=${encodeURIComponent(query)}`, signal),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useMe() {
  const link = useLink();
  return useQuery({ queryKey: keys.me, queryFn: ({ signal }) => get<Me>(link, '/api/me', signal) });
}

export function useVersion() {
  const link = useLink();
  return useQuery({ queryKey: keys.version, queryFn: ({ signal }) => get<Version>(link, '/api/version', signal) });
}

/** Saves or unsaves a title at once on screen, and puts it back if the engine refuses. */
export function useSaveTitle(id: string) {
  const link = useLink();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (saved: boolean) => post<{ saved: boolean }>(link, '/api/library', { title: id, saved }),
    onMutate: async (saved) => {
      await client.cancelQueries({ queryKey: keys.title(id) });
      const before = client.getQueryData<TitlePage>(keys.title(id));
      if (before) client.setQueryData<TitlePage>(keys.title(id), { ...before, saved });
      return { before };
    },
    onError: (_error, _saved, context) => {
      if (context?.before) client.setQueryData(keys.title(id), context.before);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: keys.title(id) });
      client.invalidateQueries({ queryKey: keys.home });
    },
  });
}

/**
 * Every download, live. The engine streams a snapshot and then each change. The stream is held only
 * while the app is in the foreground, and reopens with backoff when it drops.
 */
export function useJobs(): { jobs: Job[]; live: boolean } {
  const link = useLink();
  const [state, setState] = useState<{ jobs: Map<string, Job>; live: boolean }>({ jobs: new Map(), live: false });

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let attempt = 0;
    let generation = 0;

    const apply = (event: Event) => {
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
        try {
          await events<Event>(link, '/api/events', controller.signal, apply);
        } catch {}
        if (stopped || mine !== generation) return;
        setState((previous) => ({ ...previous, live: false }));
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)));
      }
    };

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
      controller?.abort();
      subscription.remove();
    };
  }, [link]);

  return { jobs: [...state.jobs.values()].sort((a, b) => b.added_at - a.added_at), live: state.live };
}

export function useTvs(polling: boolean) {
  const link = useLink();
  return useQuery({
    queryKey: keys.tvs,
    queryFn: ({ signal }) => get<TvList>(link, '/api/tvs', signal),
    refetchInterval: polling ? 1000 : 5000,
  });
}

export function findTvs(link: Link, fresh: boolean) {
  return post<TvList>(link, '/api/tvs', { fresh });
}
