import { describe, expect, test } from '@jest/globals';

import { arrivals, fromPieces, runsOf, type Run } from './downloaded';

describe('reading the engine’s piece map', () => {
  test.each([
    ['eighths become shares', '0248', [0, 0.25, 0.5, 1]],
    ['a stretch with nothing to arrive counts as nothing', '8-8', [1, 0, 1]],
    ['no stretches', '', []],
  ])('%s', (_, pieces, shares) => {
    expect(fromPieces(pieces)).toEqual(shares);
  });
});

describe('the runs a seek bar draws', () => {
  test.each<[string, number[], Run[]]>([
    ['nothing arrived draws nothing', [0, 0, 0, 0], []],
    ['all arrived draws one run', [1, 1, 1, 1], [{ from: 0, to: 1, share: 1 }]],
    [
      'stretches with the same share next to each other join',
      [1, 1, 0, 0.5],
      [
        { from: 0, to: 0.5, share: 1 },
        { from: 0.75, to: 1, share: 0.5 },
      ],
    ],
    [
      'a gap keeps two runs of the same share apart',
      [1, 0, 1, 0],
      [
        { from: 0, to: 0.25, share: 1 },
        { from: 0.5, to: 0.75, share: 1 },
      ],
    ],
    [
      'different shares next to each other stay apart',
      [0.5, 1],
      [
        { from: 0, to: 0.5, share: 0.5 },
        { from: 0.5, to: 1, share: 1 },
      ],
    ],
  ])('%s', (_, downloaded, runs) => {
    expect(runsOf(downloaded)).toEqual(runs);
  });
});

describe('what arrived since the last look', () => {
  test('stretches whose share grew, joined', () => {
    expect(arrivals([0, 0.25, 0.5, 1], [0.5, 0.5, 0.5, 1])).toEqual([{ from: 0, to: 0.5, share: 1 }]);
  });

  test('nothing grew, nothing arrived', () => {
    expect(arrivals([0.5, 1], [0.5, 1])).toEqual([]);
  });

  test('maps of different lengths, as when the file changes, say nothing arrived', () => {
    expect(arrivals([0, 0], [1, 1, 1])).toEqual([]);
  });
});
