import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Home, Me, TitlePage, TitleSearch, TvList, Version } from '@web/wire';

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
