import { describe, expect, test } from '@jest/globals';

import { covers, parseSpan, parseVideo, type Span } from './span';

describe('reading a span as the engine writes it', () => {
  test.each<[string, Span]>([
    ['film', { kind: 'film' }],
    ['s3e5', { kind: 'episode', season: 3, episode: 5 }],
    ['s03e05', { kind: 'episode', season: 3, episode: 5 }],
    ['s3', { kind: 'season', season: 3 }],
    ['s1-5', { kind: 'seasons', first: 1, last: 5 }],
    ['complete', { kind: 'complete' }],
  ])('%s reads as %p', (text, span) => {
    expect(parseSpan(text)).toEqual(span);
  });

  test.each(['', 'Film', 'S3', 's', 'se5', 's3e', 's1-', 's-5', 's1e2-3', 's1-2e3', '3', 's+3', 's3.0', 's4294967296'])(
    '%p is no span',
    (text) => {
      expect(parseSpan(text)).toBe(null);
    },
  );
});

describe('what a span covers, as Span::covers decides', () => {
  const episode = (season: number, number: number) => ({ season, episode: number });

  test.each<[string, Span, ReturnType<typeof episode> | null, boolean]>([
    ['a film covers the film', { kind: 'film' }, null, true],
    ['a film covers no episode', { kind: 'film' }, episode(1, 1), false],
    ['an episode covers itself', { kind: 'episode', season: 2, episode: 3 }, episode(2, 3), true],
    ['an episode covers no other episode', { kind: 'episode', season: 2, episode: 3 }, episode(2, 4), false],
    [
      'an episode covers its number in no other season',
      { kind: 'episode', season: 2, episode: 3 },
      episode(1, 3),
      false,
    ],
    ['an episode covers no film', { kind: 'episode', season: 2, episode: 3 }, null, false],
    ['a season covers its episodes', { kind: 'season', season: 2 }, episode(2, 9), true],
    ['a season covers no other season', { kind: 'season', season: 2 }, episode(3, 1), false],
    ['seasons cover their first', { kind: 'seasons', first: 1, last: 5 }, episode(1, 1), true],
    ['seasons cover their last', { kind: 'seasons', first: 1, last: 5 }, episode(5, 1), true],
    ['seasons cover none past their last', { kind: 'seasons', first: 1, last: 5 }, episode(6, 1), false],
    ['seasons cover none before their first', { kind: 'seasons', first: 2, last: 5 }, episode(1, 1), false],
    ['complete covers every episode', { kind: 'complete' }, episode(40, 1), true],
    ['complete covers no film', { kind: 'complete' }, null, false],
  ])('%s', (_, span, video, covered) => {
    expect(covers(span, video)).toBe(covered);
  });
});

describe('reading a video ID', () => {
  test('a film’s ID is its title', () => {
    expect(parseVideo('tt0063350')).toEqual({ title: 'tt0063350', episode: null });
  });

  test('an episode’s ID names its season and episode after the title', () => {
    expect(parseVideo('tt0056751:2:13')).toEqual({ title: 'tt0056751', episode: { season: 2, episode: 13 } });
  });
});
