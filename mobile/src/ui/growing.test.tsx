import { expect, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { useGrowing } from './growing';

const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

test('a long list mounts a few items at first, then more each frame, until all are mounted', async () => {
  const { result } = await renderHook(() => useGrowing(8));
  const seen = [result.current];

  for (let frame = 0; frame < 5; frame++) {
    await nextFrame();
    seen.push(result.current);
  }

  expect(seen[0]).toBe(3);
  expect(seen).toEqual([...seen].sort((a, b) => a - b));
  expect(seen.at(-1)).toBe(8);
});

test('a short list mounts whole at once', async () => {
  const { result } = await renderHook(() => useGrowing(2));

  expect(result.current).toBe(2);
});
