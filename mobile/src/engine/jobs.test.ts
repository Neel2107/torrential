import { expect, test } from '@jest/globals';

import { aJob } from '@/test/wire';

import { pickedEpisodes } from './jobs';

test('a season download that picked some episodes names them once each, in order', () => {
  const job = aJob({
    selection: {
      kind: 'patterns',
      value: ['Flash.Gordon.S01E03.mkv', 'Flash.Gordon.S01E01.mkv', 'Flash.Gordon.1x03.srt'],
    },
  });

  expect(pickedEpisodes(job)).toEqual([1, 3]);
});

test('episode numbers are read however the name writes them', () => {
  const job = aJob({ selection: { kind: 'patterns', value: ['s01 e12.mkv', 'S1-E2.mkv', '2x105.mkv'] } });

  expect(pickedEpisodes(job)).toEqual([2, 12, 105]);
});

test('a download that took every file picked no episodes', () => {
  expect(pickedEpisodes(aJob({ selection: { kind: 'all' } }))).toBe(null);
});

test('picked files whose names give no episode say nothing', () => {
  expect(pickedEpisodes(aJob({ selection: { kind: 'patterns', value: ['Sintel.2010.mkv', 'extras/'] } }))).toBe(null);
});
