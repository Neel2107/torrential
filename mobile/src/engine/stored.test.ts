import { describe, expect, test } from '@jest/globals';

import { oldLink, playerPreferences, readStored, savedEngines, unsentPositions } from './stored';

const NONE = { engines: [], active: null };

const engine = {
  id: 'http://192.168.1.5:47919',
  name: '192.168.1.5',
  kind: 'computer',
  link: { base: 'http://192.168.1.5:47919', token: 'f'.repeat(64) },
};

describe('reading the saved engines', () => {
  test('a file this version wrote reads back as written', () => {
    const saved = { engines: [engine], active: engine.id };

    expect(readStored(savedEngines, JSON.stringify(saved), NONE)).toEqual(saved);
  });

  test('no file gives the fallback', () => {
    expect(readStored(savedEngines, null, NONE)).toBe(NONE);
    expect(readStored(savedEngines, undefined, NONE)).toBe(NONE);
    expect(readStored(savedEngines, '', NONE)).toBe(NONE);
  });

  test('a file cut off mid-write gives the fallback instead of throwing', () => {
    expect(readStored(savedEngines, '{"engines":[{"id":"http://192.168.1.5:47919","na', NONE)).toBe(NONE);
  });

  test('a file from an older version that no longer fits gives the fallback', () => {
    const { kind: _dropped, ...withoutKind } = engine;

    expect(readStored(savedEngines, JSON.stringify({ engines: [withoutKind], active: null }), NONE)).toBe(NONE);
  });

  test('a file holding the wrong kind of JSON gives the fallback', () => {
    expect(readStored(savedEngines, '[]', NONE)).toBe(NONE);
    expect(readStored(savedEngines, 'null', NONE)).toBe(NONE);
  });

  test('the link saved before there were several engines still reads', () => {
    expect(readStored(oldLink, JSON.stringify(engine.link), null)).toEqual(engine.link);
  });
});

describe('reading other stored files', () => {
  test('preferences keep what this version knows and drop what it does not', () => {
    const stored = JSON.stringify({ speed: 1.5, theme: 'sepia', subtitleStyle: { scale: 1.2 } });

    expect(readStored(playerPreferences, stored, {})).toEqual({ speed: 1.5, subtitleStyle: { scale: 1.2 } });
  });

  test('an outbox holding a position of the wrong type gives the fallback', () => {
    const outbox = { 'http://engine': { tt0063350: { video: 'tt0063350', position: '12' } } };

    expect(readStored(unsentPositions, JSON.stringify(outbox), {})).toEqual({});
  });
});
