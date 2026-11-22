import { expect, test } from '@jest/globals';

import { aJob } from '@/test/wire';

import { pickedVideos } from './jobs';

test('a season download that picked some episodes names them once each, in order', () => {
  const job = aJob({
    selection: {
      kind: 'patterns',
      value: ['Flash.Gordon.S01E03.mkv', 'Flash.Gordon.S01E01.mkv', 'Flash.Gordon.1x03.srt'],
    },
  });

  expect(pickedVideos(job)).toEqual([
    { season: 1, episode: 1 },
    { season: 1, episode: 3 },
  ]);
});

test('episode numbers are read however the name writes them', () => {
  const job = aJob({ selection: { kind: 'patterns', value: ['s01 e12.mkv', 'S1-E2.mkv', '2x105.mkv'] } });

  expect(pickedVideos(job)).toEqual([
    { season: 1, episode: 2 },
    { season: 1, episode: 12 },
    { season: 2, episode: 105 },
  ]);
});

test('a pack across seasons keeps the same episode number apart in each season', () => {
  const job = aJob({ selection: { kind: 'patterns', value: ['Show.S02E01.mkv', 'Show.S01E01.mkv'] } });

  expect(pickedVideos(job)).toEqual([
    { season: 1, episode: 1 },
    { season: 2, episode: 1 },
  ]);
});

test('a download that took every file picked no episodes', () => {
  expect(pickedVideos(aJob({ selection: { kind: 'all' } }))).toBe(null);
});

test('picked files whose names give no episode say nothing', () => {
  expect(pickedVideos(aJob({ selection: { kind: 'patterns', value: ['Sintel.2010.mkv', 'extras/'] } }))).toBe(null);
});
