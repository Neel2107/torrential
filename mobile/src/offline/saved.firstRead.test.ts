import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { Directory, File, Paths } from 'expo-file-system';

import { answer, json, LINK, serve } from '@/test/engine';
import { aFile, someFiles } from '@/test/wire';

import { copyOf, disk, save, useCopies, type Label } from './saved';

const LABEL: Label = { title: 'Flash Gordon', tags: 'S1', poster: null };

const folder = new Directory(Paths.document, 'offline');

const free = disk.free;

beforeEach(() => {
  disk.free = () => 10_000_000_000;
});

afterEach(() => {
  disk.free = free;
});

/** Runs before anything has read the saved copies, so it must stay this file's only test. */
test('a save made before anything reads the saved copies neither repeats a saved one nor is lost when they are read', async () => {
  folder.create({ intermediates: true, idempotent: true });
  const kept = new File(folder, 'n0.mkv');
  kept.write('video');
  const leftover = new File(folder, 'cut.part');
  leftover.write('half');
  new File(folder, 'saved.json').write(
    JSON.stringify([{ job: 'n0', label: LABEL, size: 300, state: 'saved', saved_at: 1, uri: kept.uri }]),
  );

  answer(() => json(someFiles([aFile({ index: 0, path: 'Flash.Gordon.S01E01.mkv', size: 300 })])));
  let arrive = (_body: string) => {};

  const served = serve((address) =>
    address.includes('/n1/') ? new Promise<string>((resolve) => (arrive = resolve)) : 'video',
  );

  await save(LINK, 'n0', LABEL, 0);

  expect(served).toEqual([]);
  const saving = save(LINK, 'n1', LABEL, 0);
  await waitFor(() => expect(copyOf('n1')?.state).toBe('saving'));
  const { result } = await renderHook(() => useCopies());

  expect(result.current.map((copy) => [copy.job, copy.state])).toEqual([
    ['n1', 'saving'],
    ['n0', 'saved'],
  ]);

  arrive('video');
  await saving;

  expect(copyOf('n1')?.state).toBe('saved');
  expect(new File(folder, 'n1.mkv').exists).toBe(true);
  expect(leftover.exists).toBe(false);
});
