import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';

import { saveWanted, wantCopy } from '@/engine/download';
import { answer, json, LINK, serve } from '@/test/engine';
import { aFile, someFiles } from '@/test/wire';

import { copyOf, disk, retry, save, type Copy, type Label } from './saved';

const LABEL: Label = { title: 'Flash Gordon', tags: 'S1', poster: null };

const pack = someFiles([
  aFile({ index: 0, path: 'Flash.Gordon.S01/Flash.Gordon.S01E01.mkv', size: 300 }),
  aFile({ index: 1, path: 'Flash.Gordon.S01/Flash.Gordon.S01E02.mkv', size: 500 }),
]);

const FIRST_EPISODE = (job: string) => `${LINK.base}/${job}/0/Flash.Gordon.S01E01.mkv`;

const dropped = () => Promise.reject(new Error('The connection dropped.'));

const outage = () => {
  throw new TypeError('Network request failed');
};

const free = disk.free;

beforeEach(() => {
  disk.free = () => 10_000_000_000;
});

afterEach(() => {
  disk.free = free;
});

function failed(job: string): Copy {
  const copy = copyOf(job);

  if (copy?.state !== 'failed') throw new Error(`${job}'s copy is ${copy?.state ?? 'missing'}, not failed`);

  return copy;
}

describe('trying a failed copy again', () => {
  test('copies the episode that was asked for, not the largest video', async () => {
    answer(() => json(pack));
    serve(dropped);
    await save(LINK, 'r1', LABEL, 0);

    const served = serve(() => 'video');
    await retry(LINK, failed('r1'));

    expect(served).toEqual([FIRST_EPISODE('r1')]);
    expect(copyOf('r1')).toMatchObject({ state: 'saved', size: 300 });
  });

  test('copies the episode asked for when the engine could not list the files the first time', async () => {
    answer(outage);
    await save(LINK, 'r2', LABEL, 0);

    answer(() => json(pack));
    const served = serve(() => 'video');
    await retry(LINK, failed('r2'));

    expect(served).toEqual([FIRST_EPISODE('r2')]);
  });

  test('a copy asked for without naming a file still copies the largest video', async () => {
    answer(() => json(pack));
    serve(dropped);
    await save(LINK, 'r3', LABEL);

    const served = serve(() => 'video');
    await retry(LINK, failed('r3'));

    expect(served).toEqual([`${LINK.base}/r3/1/Flash.Gordon.S01E02.mkv`]);
  });
});

describe('saving a computer’s download when it finishes', () => {
  test('a failed copy keeps the ask, and the next try saves the episode asked for and forgets it', async () => {
    answer(() => json(pack));
    wantCopy('w1', LABEL, 0);
    serve(dropped);
    await saveWanted(LINK, ['w1']);

    expect(copyOf('w1')?.state).toBe('failed');

    const served = serve(() => 'video');
    await saveWanted(LINK, ['w1']);
    await saveWanted(LINK, ['w1']);

    expect(served).toEqual([FIRST_EPISODE('w1')]);
    expect(copyOf('w1')).toMatchObject({ state: 'saved', size: 300 });
  });

  test('a failed copy tried again by hand saves the episode asked for, and the ask is then forgotten', async () => {
    answer(() => json(pack));
    wantCopy('w2', LABEL, 0);
    serve(dropped);
    await saveWanted(LINK, ['w2']);

    const served = serve(() => 'video');
    await retry(LINK, failed('w2'));
    await saveWanted(LINK, ['w2']);

    expect(served).toEqual([FIRST_EPISODE('w2')]);
    expect(copyOf('w2')).toMatchObject({ state: 'saved', size: 300 });
  });

  test('only downloads that were asked for are saved', async () => {
    answer(() => json(pack));
    const served = serve(() => 'video');
    await saveWanted(LINK, ['w3']);

    expect(served).toEqual([]);
    expect(copyOf('w3')).toBe(undefined);
  });
});
