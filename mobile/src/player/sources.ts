import { useQuery, useQueryClient } from '@tanstack/react-query';

import { sentence } from '@web/lib/format';
import type { Release, SearchMessage } from '@web/wire';

import { stream, url } from '@/engine/client';
import { useLink } from '@/engine/session';

import { useViewer } from './start';

export type Sources = { releases: Release[]; done: boolean; error: string | null };

export function useSources(video: string | null) {
  const link = useLink();
  const viewer = useViewer();
  const client = useQueryClient();
  const key = ['sources', video, link.base] as const;
  return useQuery<Sources>({
    queryKey: key,
    enabled: Boolean(video),
    staleTime: 4 * 60_000,
    queryFn: async ({ signal }) => {
      let latest: Sources = { releases: [], done: false, error: null };
      const path = url({ ...link, base: '' }, '/api/title/sources', {
        video,
        width: viewer.width,
        height: viewer.height,
        scale: viewer.scale,
        playback: viewer.playback,
        h264: viewer.decoders?.h264,
        hevc: viewer.decoders?.hevc,
        av1: viewer.decoders?.av1,
      });
      await stream<SearchMessage>(link, path, { method: 'GET', signal }, (message) => {
        if (message.type === 'update') latest = { releases: message.result.releases, done: false, error: null };
        if (message.type === 'done') latest = { releases: message.result.releases, done: true, error: null };
        if (message.type === 'error') latest = { ...latest, done: true, error: sentence(message.error.message) };
        if (!latest.done) client.setQueryData(key, latest);
      });
      return { ...latest, done: true };
    },
  });
}
