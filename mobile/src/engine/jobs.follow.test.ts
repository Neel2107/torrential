import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { AppStateStatus } from 'react-native';

import { answer, anOpenStream, LINK, refusal } from '@/test/engine';
import { aJob, anError } from '@/test/wire';
import type { Event } from '@web/wire';

import { applyEvent, follow, type Foreground, type State } from './jobs';

/** The app's place on screen, which a test moves between the front and the background. */
function anApp(): Foreground & { go: (next: AppStateStatus) => void } {
  const listeners = new Set<(next: AppStateStatus) => void>();
  let current: AppStateStatus = 'active';

  return {
    get currentState() {
      return current;
    },
    addEventListener: (_type, listener) => {
      listeners.add(listener);

      return { remove: () => listeners.delete(listener) };
    },
    go: (next) => {
      current = next;

      for (const listener of listeners) listener(next);
    },
  };
}

const EMPTY: State = { jobs: new Map(), live: false };

const replay = (events: Event[], from: State = EMPTY) => events.reduce(applyEvent, from);

const ids = (state: State) => [...state.jobs.keys()];

describe('what each event does to the downloads', () => {
  test('a snapshot replaces every download and makes the list live', () => {
    const state = replay([
      { event: 'snapshot', jobs: [aJob({ id: 'a1' })] },
      { event: 'snapshot', jobs: [aJob({ id: 'b2' })] },
    ]);

    expect(ids(state)).toEqual(['b2']);
    expect(state.live).toBe(true);
  });

  test('a job event adds a new download and replaces one it already has', () => {
    const state = replay([
      { event: 'snapshot', jobs: [aJob({ id: 'a1', name: 'Sintel' })] },
      { event: 'job', job: aJob({ id: 'b2' }) },
      { event: 'job', job: aJob({ id: 'a1', name: 'Sintel (2010)' }) },
    ]);

    expect(ids(state)).toEqual(['a1', 'b2']);
    expect(state.jobs.get('a1')?.name).toBe('Sintel (2010)');
  });

  test('a removal drops the download, and one it does not have changes nothing else', () => {
    const state = replay([
      { event: 'snapshot', jobs: [aJob({ id: 'a1' }), aJob({ id: 'b2' })] },
      { event: 'removed', id: 'a1' },
      { event: 'removed', id: 'zz' },
    ]);

    expect(ids(state)).toEqual(['b2']);
  });

  test('a heartbeat makes the list live and keeps the downloads as they were', () => {
    const before: State = { jobs: new Map([['a1', aJob({ id: 'a1' })]]), live: false };
    const after = applyEvent(before, { event: 'heartbeat', at: 7 });

    expect(after).toEqual({ jobs: before.jobs, live: true });
  });

  test('a heartbeat on a list already live is the same list, so nothing re-renders', () => {
    const live: State = { jobs: new Map(), live: true };

    expect(applyEvent(live, { event: 'heartbeat', at: 7 })).toBe(live);
  });
});

describe('following the engine’s events', () => {
  let state: State = EMPTY;
  let stop = () => {};
  let app = anApp();

  const update = (change: (previous: State) => State) => {
    state = change(state);
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
    state = EMPTY;
    app = anApp();
  });

  afterEach(() => {
    stop();
    jest.useRealTimers();
  });

  test('after each failure it tries again 1 s later, doubling to at most 10 s', async () => {
    const tried: number[] = [];
    answer(() => {
      tried.push(Date.now());

      return refusal(503, anError('daemon_unavailable', 'The engine is starting.'));
    });

    stop = follow(LINK, update, app);
    await jest.advanceTimersByTimeAsync(60_000);

    const waits = tried.slice(1).map((at, i) => at - tried[i]);

    expect(waits.slice(0, 7)).toEqual([1_000, 2_000, 4_000, 8_000, 10_000, 10_000, 10_000]);
    expect(state.live).toBe(false);
  });

  test('an event heard starts the waits from 1 s again', async () => {
    const tried: number[] = [];
    answer(({ init }) => {
      tried.push(Date.now());

      if (tried.length !== 4) return refusal(503, anError('daemon_unavailable', 'The engine is starting.'));
      const { reply, send } = anOpenStream(init);
      send(`data: ${JSON.stringify({ event: 'snapshot', jobs: [] })}\n\n`);
      setTimeout(() => send('data: {\n\n'), 100);

      return reply;
    });

    stop = follow(LINK, update, app);
    await jest.advanceTimersByTimeAsync(20_000);

    const waits = tried.slice(1).map((at, i) => at - tried[i]);

    expect(waits.slice(0, 4)).toEqual([1_000, 2_000, 4_000, 1_100]);
  });

  test('a connection silent for 35 s is dropped and opened again', async () => {
    const tried: number[] = [];
    answer(({ init }) => {
      tried.push(Date.now());

      return anOpenStream(init).reply;
    });

    stop = follow(LINK, update, app);
    await jest.advanceTimersByTimeAsync(45_000);

    expect(tried).toEqual([0, 41_000]);
  });

  test('a connection that keeps hearing heartbeats is kept', async () => {
    const tried: number[] = [];
    answer(({ init }) => {
      tried.push(Date.now());
      const { reply, send } = anOpenStream(init);

      const beat = setInterval(
        () => send(`data: ${JSON.stringify({ event: 'heartbeat', at: Date.now() })}\n\n`),
        15_000,
      );

      init.signal?.addEventListener('abort', () => clearInterval(beat));

      return reply;
    });

    stop = follow(LINK, update, app);
    await jest.advanceTimersByTimeAsync(120_000);

    expect(tried).toEqual([0]);
    expect(state.live).toBe(true);
  });

  test('once stopped it opens no more connections', async () => {
    const tried: number[] = [];
    answer(() => {
      tried.push(Date.now());

      return refusal(503, anError('daemon_unavailable', 'The engine is starting.'));
    });

    stop = follow(LINK, update, app);
    await jest.advanceTimersByTimeAsync(0);
    stop();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(tried).toEqual([0]);
  });

  test('in the background it closes the connection and opens none, and back in front it opens one at once', async () => {
    const tried: number[] = [];
    const closed: number[] = [];
    answer(({ init }) => {
      tried.push(Date.now());
      init.signal?.addEventListener('abort', () => closed.push(Date.now()));

      return anOpenStream(init).reply;
    });

    stop = follow(LINK, update, app);
    await jest.advanceTimersByTimeAsync(1_000);
    app.go('background');
    await jest.advanceTimersByTimeAsync(60_000);

    expect(tried).toEqual([0]);
    expect(closed).toEqual([1_000]);

    app.go('active');
    await jest.advanceTimersByTimeAsync(0);

    expect(tried).toEqual([0, 61_000]);
  });
});
