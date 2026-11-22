import { expect, test } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { OnlineSubtitles } from '@web/wire';

import { answer, json, LINK } from '@/test/engine';

import { useOnlineSubtitles } from './Subtitles';

const FOUND: OnlineSubtitles = {
  title: null,
  hashed: true,
  subtitles: [{ id: 'os-1', language: 'en', name: 'Charade.1963.en.srt', exact: true, source: 'opensubtitles' }],
};

test('a play nobody wants online subtitles for never looks them up', async () => {
  const asked = answer(() => json(FOUND));

  await renderHook(() => useOnlineSubtitles(LINK, 'job', 0, false));
  await act(async () => {});

  expect(asked).toHaveLength(0);
});

test('online subtitles are looked up once they are needed, and only once', async () => {
  const asked = answer(() => json(FOUND));

  const { result, rerender } = await renderHook(
    ({ needed }: { needed: boolean }) => useOnlineSubtitles(LINK, 'job', 0, needed),
    { initialProps: { needed: false } },
  );

  await rerender({ needed: true });
  await waitFor(() => expect(result.current.kind).toBe('found'));

  await rerender({ needed: false });
  await rerender({ needed: true });
  await act(async () => {});

  expect(asked.map((one) => one.address)).toEqual([`${LINK.base}/api/subtitles/online?id=job&file=0`]);
});
