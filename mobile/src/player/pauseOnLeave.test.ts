import { expect, test } from '@jest/globals';

import { aJob } from '@/test/wire';

import { pausesOnLeave } from './pauseOnLeave';

const CHARADE = { title: 'tt0056923', span: 'tt0056923', release: null };
const PLAY = aJob({ place: 'plays', title: CHARADE });

test('a title played on mobile data pauses as the player closes', () => {
  expect(pausesOnLeave(PLAY, false, true)).toBe(true);
});

test('on Wi-Fi a play keeps downloading until the engine pauses it', () => {
  expect(pausesOnLeave(PLAY, false, false)).toBe(false);
});

test('a download to keep, a saved title, or a title not yet known never pauses', () => {
  expect(pausesOnLeave(aJob({ place: 'folder', title: CHARADE }), false, true)).toBe(false);
  expect(pausesOnLeave(PLAY, true, true)).toBe(false);
  expect(pausesOnLeave(PLAY, undefined, true)).toBe(false);
  expect(pausesOnLeave(aJob({ place: 'plays', title: null }), false, true)).toBe(false);
});
