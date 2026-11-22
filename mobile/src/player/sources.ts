import { useQuery, useQueryClient } from '@tanstack/react-query';

import { sentence } from '@web/lib/format';
import type { Release, SearchMessage } from '@web/wire';

import { stream, url } from '@/engine/client';
import { useLink } from '@/engine/session';

import { useViewer } from './start';

export type Sources = { releases: Release[]; done: boolean; error: string | null };

/**
 * Every release of a film or episode, ranked for this phone, as one cached query. The title page
 * starts it as it opens, so Sources shows at once; and the engine keeps what its sources answered
 * for five minutes, so Play, which asks the same search, starts without searching again.
 */
export function useSources(video: string | null) {
  const link = useLink();
  const viewer = useViewer();
  const client = useQueryClient();
  const key = ['sources', video, link.base] as const;
  return useQuery<Sources>({
    queryKey: key,
    enabled: Boolean(video),
    // Under the engine's five minutes, so a reopened page never shows answers the engine has dropped.
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
        // Each source's answer shows as it comes, before the whole search ends.
        if (!latest.done) client.setQueryData(key, latest);
      });
      return { ...latest, done: true };
    },
  });
}
