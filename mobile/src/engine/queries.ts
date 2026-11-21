import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Cast, CastAction, Home, Me, TitlePage, TitleSearch, TvList, Version } from '@web/wire';

import { get, post, type Link } from './client';
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

/** Saves or unsaves a title at once on screen, and puts it back if the engine refuses. */
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

/** The TVs and their casts, asked for every second while one plays and every five seconds otherwise. */
export function useCasts() {
  const link = useLink();
  return useQuery({
    queryKey: [...keys.tvs, link.base],
    queryFn: ({ signal }) => get<TvList>(link, '/api/tvs', signal),
    refetchInterval: (query) => (query.state.data?.casts.some((cast) => cast.state !== 'ended') ? 1000 : 5000),
  });
}

/** Sends a remote action to a TV and takes the cast the engine answers with over the last poll. */
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
