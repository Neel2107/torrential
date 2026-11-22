import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { useLingered } from './linger';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('work waits until a person has stayed, then stays on', async () => {
  const { result, rerender } = await renderHook(({ on }: { on: boolean }) => useLingered(on, 1500), {
    initialProps: { on: true },
  });

  await act(() => jest.advanceTimersByTime(1499));
  expect(result.current).toBe(false);

  await act(() => jest.advanceTimersByTime(1));
  expect(result.current).toBe(true);

  await rerender({ on: false });
  expect(result.current).toBe(true);
});

test('leaving before the time is up never starts the work', async () => {
  const { result, unmount } = await renderHook(({ on }: { on: boolean }) => useLingered(on, 1500), {
    initialProps: { on: true },
  });

  await act(() => jest.advanceTimersByTime(800));
  await unmount();
  await act(() => jest.advanceTimersByTime(2000));
  expect(result.current).toBe(false);
});
