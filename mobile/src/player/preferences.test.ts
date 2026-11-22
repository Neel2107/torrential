import { expect, test } from '@jest/globals';

import { SUBTITLE_STYLE } from '@web/lib/storage';

import { readPreferences } from './preferences';

const DEFAULTS = { speed: 1, subtitleStyle: SUBTITLE_STYLE };

test.each<[string, string | null, object]>([
  ['nothing stored gives the defaults', null, DEFAULTS],
  ['a file that does not read gives the defaults', '{"speed":', DEFAULTS],
  ['a speed stored replaces the default', '{"speed":1.5}', { ...DEFAULTS, speed: 1.5 }],
  [
    'a subtitle style stored in part keeps the default for the rest',
    '{"subtitleStyle":{"scale":1.4}}',
    { ...DEFAULTS, subtitleStyle: { ...SUBTITLE_STYLE, scale: 1.4 } },
  ],
  ['subtitles turned off stay off', '{"subtitles":null}', { ...DEFAULTS, subtitles: null }],
  [
    'what each show picked is kept',
    '{"shows":{"tt0056751":{"subtitles":"en","audio":"ja"}}}',
    { ...DEFAULTS, shows: { tt0056751: { subtitles: 'en', audio: 'ja' } } },
  ],
  ['a field of the wrong type gives the defaults', '{"speed":"fast"}', DEFAULTS],
  ['a field this version does not know is dropped', '{"speed":2,"theme":"sepia"}', { ...DEFAULTS, speed: 2 }],
])('%s', (_, saved, preferences) => {
  expect(readPreferences(saved)).toEqual(preferences);
});
