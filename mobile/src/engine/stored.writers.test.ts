import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { File, Paths } from 'expo-file-system';

import { readPreferences, type PlayerPreferences } from '@/player/preferences';
import { copyOf, disk, save, type Label } from '@/offline/saved';
import { answer, json, LINK, serve } from '@/test/engine';
import { aFile, aPosition, someFiles } from '@/test/wire';

import { wantCopy } from './download';
import { remembered } from './recent';
import { playerPreferences, readStored, recentSearches, savedCopies, unsentPositions, wantedCopies } from './stored';
import { report } from './watched';

const LABEL: Label = { title: 'Sintel', tags: '2010', poster: 'tt1727587' };

const stored = (...path: string[]) => {
  const file = new File(Paths.document, ...path);

  return file.exists ? file.textSync() : null;
};

const free = disk.free;

beforeEach(() => {
  disk.free = () => 10_000_000_000;
});

afterEach(() => {
  disk.free = free;
});

describe('what each writer stores reads back as it was written', () => {
  test('positions kept while the engine is out of reach', async () => {
    const position = aPosition({ video: 'tt1727587', position: 42.5, release: 'r1', tab: 'phone' });
    answer(() => {
      throw new TypeError('Network request failed');
    });
    await report(LINK, position);

    expect(readStored(unsentPositions, stored('unsent-positions.json'), null)).toEqual({
      [LINK.base]: { tt1727587: position },
    });
  });

  test('copies asked for once a download finishes', () => {
    wantCopy('a1', LABEL, 3);
    wantCopy('b2', { ...LABEL, poster: null }, 0);

    expect(readStored(wantedCopies, stored('save-when-done.json'), null)).toEqual({
      a1: { label: LABEL, file: 3 },
      b2: { label: { ...LABEL, poster: null }, file: 0 },
    });
  });

  test('the manifest of copies saved on the phone', async () => {
    answer(() => json(someFiles([aFile({ index: 2, path: 'Sintel.2010.mkv', size: 300 })])));
    serve(() => 'video');
    await save(LINK, 'a1', LABEL, 2);

    expect(copyOf('a1')?.state).toBe('saved');
    expect(readStored(savedCopies, stored('offline', 'saved.json'), null)).toEqual([copyOf('a1')]);
  });

  test('recent searches', () => {
    const recent = remembered(remembered([], 'sintel'), 'Big Buck Bunny');

    expect(readStored(recentSearches, JSON.stringify(recent), null)).toEqual(recent);
  });

  test('player preferences, read back whole', () => {
    const preferences: PlayerPreferences = {
      speed: 1.25,
      subtitleStyle: { scale: 1.2, backing: 'box', lift: 10 },
      subtitles: null,
      shows: { tt0056751: { subtitles: 'en', audio: 'ja' }, tt0063350: { subtitles: null } },
    };

    expect(readStored(playerPreferences, JSON.stringify(preferences), null)).toEqual(preferences);
    expect(readPreferences(JSON.stringify(preferences))).toEqual(preferences);
  });
});
