import { describe, expect, test } from '@jest/globals';

import { aJob, anError } from '@/test/wire';
import type { Job, JobStatus } from '@web/wire';

import { held } from './download';

const SHOW = 'tt0056751';
const FILM = 'tt0063350';

function holding(span: string, change: Partial<Job> = {}, status?: JobStatus): Job {
  return aJob({ title: { title: SHOW, span, release: null }, ...change }, status);
}

const done: JobStatus = { state: 'done', finished_at: 1 };

describe('whether a download holds an episode', () => {
  test.each([
    ['film', `${FILM}`, 'film', true],
    ['an episode', `${SHOW}:2:3`, 's2e3', true],
    ['another episode', `${SHOW}:2:4`, 's2e3', false],
    ['its season', `${SHOW}:2:4`, 's2', true],
    ['another season', `${SHOW}:3:1`, 's2', false],
    ['a pack of seasons', `${SHOW}:3:1`, 's1-5', true],
    ['the first season of a pack', `${SHOW}:1:1`, 's1-5', true],
    ['the last season of a pack', `${SHOW}:5:9`, 's1-5', true],
    ['a season past a pack', `${SHOW}:6:1`, 's1-5', false],
    ['every season', `${SHOW}:12:1`, 'complete', true],
  ])('%s: %s held by a download of %s is %p', (_, video, span, holds) => {
    const job = aJob({ title: { title: video.split(':')[0], span, release: null } }, done);

    expect(held([job], video).state).toBe(holds ? 'done' : 'none');
  });

  test('a film is not held by a download of a show’s season, nor an episode by the film', () => {
    expect(held([aJob({ title: { title: SHOW, span: 's1', release: null } }, done)], SHOW).state).toBe('none');
    expect(held([aJob({ title: { title: SHOW, span: 'film', release: null } }, done)], `${SHOW}:1:1`).state).toBe(
      'none',
    );
  });

  test('a download of another title holds nothing', () => {
    expect(held([aJob({ title: { title: FILM, span: 'complete', release: null } }, done)], `${SHOW}:1:1`).state).toBe(
      'none',
    );
  });

  test('a span the engine does not write holds nothing', () => {
    expect(held([holding('S1')], `${SHOW}:1:1`).state).toBe('none');
    expect(held([holding('s1e')], `${SHOW}:1:1`).state).toBe('none');
  });

  test('no video, or no downloads, holds nothing', () => {
    expect(held([holding('complete', {}, done)], null)).toEqual({ state: 'none', fraction: 0 });
    expect(held([], `${SHOW}:1:1`)).toEqual({ state: 'none', fraction: 0 });
  });
});

describe('a pack that picked some of its episodes', () => {
  const picked = (span: string, names: string[]) =>
    holding(span, { selection: { kind: 'patterns', value: names } }, done);

  test('holds the episodes it picked and not the others', () => {
    const season = picked('s1', ['Show.S01E02.mkv', 'Show.S01E04.mkv']);

    expect(held([season], `${SHOW}:1:2`).state).toBe('done');
    expect(held([season], `${SHOW}:1:3`).state).toBe('none');
  });

  test('across seasons, holds an episode only in the season it was picked from', () => {
    const pack = picked('s1-3', ['Show.S01E02.mkv', 'Show.S03E05.mkv']);

    expect(held([pack], `${SHOW}:3:5`).state).toBe('done');
    expect(held([pack], `${SHOW}:1:5`).state).toBe('none');
    expect(held([pack], `${SHOW}:2:2`).state).toBe('none');
  });

  test('whose names say no episode holds every episode it spans', () => {
    expect(held([picked('complete', ['Extras/'])], `${SHOW}:4:1`).state).toBe('done');
  });

  test('an episode download holds its episode whatever it picked', () => {
    expect(held([picked('s2e3', ['Show.S02E07.mkv'])], `${SHOW}:2:3`).state).toBe('done');
  });
});

describe('how far the download holding an episode has come', () => {
  const at = (verified: number, change: Partial<Job> = {}, status?: JobStatus) =>
    holding('s1-2', { progress: { ...aJob().progress, size: 100, verified }, ...change }, status);

  test('a finished download wins over ones still going', () => {
    expect(held([at(30), at(100, { id: 'b2' }, done)], `${SHOW}:1:1`)).toEqual({ state: 'done', fraction: 1 });
  });

  test('a paused or failed download does not count as downloading', () => {
    const stopped = [
      at(40, { id: 'p1' }, { state: 'paused' }),
      at(60, { id: 'e1' }, { state: 'error', error: anError('disk_full', 'The disk is full.') }),
    ];

    expect(held(stopped, `${SHOW}:1:1`)).toEqual({ state: 'none', fraction: 0 });
  });

  test('the furthest download counts when none is preferred', () => {
    expect(held([at(30, { id: 'a1' }), at(70, { id: 'b2' })], `${SHOW}:2:1`)).toEqual({
      state: 'downloading',
      fraction: 0.7,
    });
  });

  test('the preferred download counts even when another is further', () => {
    expect(held([at(30, { id: 'a1' }), at(70, { id: 'b2' })], `${SHOW}:2:1`, 'a1')).toEqual({
      state: 'downloading',
      fraction: 0.3,
    });
  });

  test('a download that does not know its size yet has come nowhere', () => {
    expect(held([at(0, { progress: { ...aJob().progress, size: 0 } })], `${SHOW}:1:1`)).toEqual({
      state: 'downloading',
      fraction: 0,
    });
  });
});
