import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useCallback } from 'react';

import type { Cast, CastAction, Home, Me, TitlePage, TitleSearch, TvList, Version } from '@web/wire';

import { authHeaders, get, post, url, type Link } from './client';
import { useLink } from './session';

export const keys = {
  home: ['home'] as const,
  title: (id: string) => ['title', id] as const,
  titles: (q: string) => ['titles', q] as const,
  popular: (kind: 'film' | 'series') => ['popular', kind] as const,
  me: ['me'] as const,
  version: ['version'] as const,
  tvs: ['tvs'] as const,
};

export function useHome() {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.home, link.base],
    queryFn: ({ signal }) => get<Home>(link, '/api/home', signal),
  });
}

export function useTitle(id: string, enabled = true) {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.title(id), link.base],
    enabled: enabled && id.length > 0,
    queryFn: ({ signal }) => get<TitlePage>(link, `/api/title?id=${encodeURIComponent(id)}`, signal),
  });
}

export function usePrefetchTitle() {
  const link = useLink();
  const client = useQueryClient();
  return useCallback(
    (id: string) => {
      client.prefetchQuery({
        queryKey: [...keys.title(id), link.base],
        queryFn: ({ signal }) => get<TitlePage>(link, `/api/title?id=${encodeURIComponent(id)}`, signal),
      });
      Image.prefetch(url(link, '/api/title/art', { id, kind: 'background' }), {
        headers: authHeaders(link),
        cachePolicy: 'memory-disk',
      });
    },
    [client, link],
  );
}

/** What is popular now, films or series. Kept for an hour; a failure, such as an engine without the route, leaves it empty. */
export function usePopular(kind: 'film' | 'series', enabled = true) {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.popular(kind), link.base],
    enabled,
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: ({ signal }) => get<TitleSearch>(link, `/api/titles/popular?kind=${kind}`, signal),
  });
}

export function useTitleSearch(q: string) {
  const link = useLink();
  const query = q.trim();
  return useQuery({
    queryKey: [...keys.titles(query), link.base],
    queryFn: ({ signal }) => get<TitleSearch>(link, `/api/titles?q=${encodeURIComponent(query)}`, signal),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useMe() {
  const link = useLink();
  return useQuery({ queryKey: [...keys.me, link.base], queryFn: ({ signal }) => get<Me>(link, '/api/me', signal) });
}

export function useVersion() {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.version, link.base],
    queryFn: ({ signal }) => get<Version>(link, '/api/version', signal),
  });
}

export function useSaveTitle(id: string) {
  const link = useLink();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (saved: boolean) => post<{ saved: boolean }>(link, '/api/library', { title: id, saved }),
    onMutate: async (saved) => {
      const key = [...keys.title(id), link.base];
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<TitlePage>(key);
      if (before) client.setQueryData<TitlePage>(key, { ...before, saved });
      return { before };
    },
    onError: (_error, _saved, context) => {
      if (context?.before) client.setQueryData([...keys.title(id), link.base], context.before);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: keys.title(id) });
      client.invalidateQueries({ queryKey: keys.home });
    },
  });
}

export function useTvs(polling: boolean) {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.tvs, link.base],
    queryFn: ({ signal }) => get<TvList>(link, '/api/tvs', signal),
    refetchInterval: polling ? 1000 : 5000,
  });
}

export function findTvs(link: Link, fresh: boolean) {
  return post<TvList>(link, '/api/tvs', { fresh });
}

const IDLE_CAST_MS = 60_000;

export function useCasts() {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.tvs, link.base],
    queryFn: ({ signal }) => get<TvList>(link, '/api/tvs', signal),
    refetchInterval: (query) => (query.state.data?.casts.some((cast) => cast.state !== 'ended') ? 1000 : IDLE_CAST_MS),
  });
}

export function useCastControl() {
  const link = useLink();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { tv: string } & CastAction) => post<{ cast: Cast }>(link, '/api/cast/control', body),
    onSuccess: ({ cast }) =>
      client.setQueryData<TvList>([...keys.tvs, link.base], (list) =>
        list ? { ...list, casts: [...list.casts.filter((other) => other.tv !== cast.tv), cast] } : list,
      ),
  });
}
