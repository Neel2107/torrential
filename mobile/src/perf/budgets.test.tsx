import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ExpoRoot, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Event, Home, SearchMessage, TitlePage, TitleSearch, TvList, Version } from '@web/wire';

import type { Reply } from '@/engine/client';
import { shelf } from '@/engine/kept';
import { keychain } from '@/engine/session';
import { anOpenStream, answer, inPieces, json, refusal, type Asked } from '@/test/engine';
import { aRelease, aSearchResult, aTitle, aTitlePage, anEpisode, anError } from '@/test/wire';

import { NETWORK, type Budget } from './budgets';

/** The app's route files, read only when Expo Router asks for one, as Metro's `require.context` hands them over in a lazy build. */
const ROUTES = new Map<string, () => object>([
  ['./_layout.tsx', () => require('@/app/_layout')],
  ['./(tabs)/_layout.tsx', () => require('@/app/(tabs)/_layout')],
  ['./(tabs)/index.tsx', () => require('@/app/(tabs)/index')],
  ['./(tabs)/search.tsx', () => require('@/app/(tabs)/search')],
  ['./(tabs)/downloads.tsx', () => require('@/app/(tabs)/downloads')],
  ['./title/[id].tsx', () => require('@/app/title/[id]')],
  ['./add.tsx', () => require('@/app/add')],
  ['./engine.tsx', () => require('@/app/engine')],
  ['./offline.tsx', () => require('@/app/offline')],
  ['./pair.tsx', () => require('@/app/pair')],
  ['./play.tsx', () => require('@/app/play')],
  ['./relocate.tsx', () => require('@/app/relocate')],
  ['./saved.tsx', () => require('@/app/saved')],
  ['./settings.tsx', () => require('@/app/settings')],
  ['./tv.tsx', () => require('@/app/tv')],
]);

const APP = Object.assign(
  (key: string) => {
    const route = ROUTES.get(key);

    if (!route) throw new Error(`No route file ${key}`);

    return route();
  },
  { keys: () => [...ROUTES.keys()], resolve: (key: string) => key, id: 'src/app' },
);

/** The route files the scenarios render. Jest compiles them on first use, which takes about a minute with a cold cache, as on CI. */
const RENDERED = ['./_layout.tsx', './(tabs)/_layout.tsx', './(tabs)/index.tsx', './title/[id].tsx'];

/** Compiles the screens once, before any scenario starts its clock, so a cold cache costs time here and not in a scenario. */
function compileTheScreens() {
  for (const key of RENDERED) APP(key);
}

beforeAll(compileTheScreens, 300_000);

jest.setTimeout(30_000);

const METRICS = {
  frame: { x: 0, y: 0, width: 412, height: 915 },
  insets: { top: 32, left: 0, right: 0, bottom: 24 },
};

const LAUNCHED_AT = Date.UTC(2026, 10, 20, 20);
const DAY_S = 86_400;
const aired = (daysAgo: number) => LAUNCHED_AT / 1000 - daysAgo * DAY_S;

const FILM = aTitlePage({ saved: true });

const SHOW = aTitlePage({
  id: 'tt9000001',
  kind: 'series',
  name: 'Blender Open Movies',
  year: 2006,
  rating: 7.1,
  saved: true,
  runtime_min: null,
  play_target: { video: 'tt9000001:1:3', resume_at: null },
  next: { video: 'tt9000001:1:3', resume_at: null },
  seasons: [
    {
      number: 1,
      episodes: [
        anEpisode({ name: 'Elephants Dream', episode: 1, aired: aired(40) }),
        anEpisode({ name: 'Big Buck Bunny', episode: 2, aired: aired(20) }),
        anEpisode({ name: 'Sintel', episode: 3, aired: aired(3) }),
      ],
    },
  ],
});

const OTHER_SHOW = aTitlePage({
  id: 'tt9000002',
  kind: 'series',
  name: 'Blender Studio Shorts',
  year: 2012,
  rating: 6.9,
  saved: true,
  runtime_min: null,
  play_target: { video: 'tt9000002:1:1', resume_at: null },
  seasons: [{ number: 1, episodes: [anEpisode({ name: 'Tears of Steel', aired: aired(2) })] }],
});

const cardOf = (page: TitlePage) =>
  aTitle({ id: page.id, kind: page.kind, name: page.name, year: page.year, rating: page.rating });

/** What one engine holds for a scenario: its Home, the pages it knows and what is popular. */
type World = { base: string; home: Home; pages: TitlePage[]; popular: { film: TitleSearch; series: TitleSearch } };

const POPULAR = {
  film: { titles: [cardOf(FILM), aTitle({ id: 'tt1727587', name: 'Sintel', year: 2010, rating: 7.4 })] },
  series: { titles: [cardOf(SHOW), cardOf(OTHER_SHOW)] },
};

const PAGES = [FILM, SHOW, OTHER_SHOW];

let worlds = 0;

function aWorld(home: Home): World {
  worlds += 1;

  return { base: `http://engine-${worlds}.test:47919`, home, pages: PAGES, popular: POPULAR };
}

const withSavedShows = () => aWorld({ continue: [], saved: [cardOf(SHOW), cardOf(OTHER_SHOW), cardOf(FILM)] });
const withNothingSaved = () => aWorld({ continue: [], saved: [] });

const VERSION: Version = { version: '0.7.0', notice: null };
const NO_TVS: TvList = { tvs: [], casts: [] };
const SNAPSHOT: Event = { event: 'snapshot', jobs: [] };
const RELEASES = [aRelease(), aRelease({ id: 'r2', name: 'Sintel.2010.720p.WEB.x264', seeders: 4 })];

const SEARCH: SearchMessage[] = [
  { type: 'update', result: aSearchResult(RELEASES.slice(0, 1)), pending: ['archive'] },
  { type: 'done', result: aSearchResult(RELEASES) },
];

type Answer = { reply: Reply; chars: number };

/** What the engine's JSON routes in these scenarios answer with. */
type Replied = Home | Version | TvList | TitlePage | TitleSearch;

const replying = (value: Replied): Answer => ({ reply: json(value), chars: JSON.stringify(value).length });

/** The engine's answer to one request in `world`, as its routes answer, and how many characters it sends back. */
function engineAnswer(world: World, route: string, query: string, asked: Asked): Answer {
  const param = (name: string) => decodeURIComponent(new RegExp(`(?:^|&)${name}=([^&]*)`).exec(query)?.[1] ?? '');

  if (route === '/api/home') return replying(world.home);

  if (route === '/api/version') return replying(VERSION);

  if (route === '/api/tvs') return replying(NO_TVS);

  if (route === '/api/titles/popular')
    return replying(param('kind') === 'film' ? world.popular.film : world.popular.series);

  if (route === '/api/title') {
    const page = world.pages.find((known) => known.id === param('id'));

    return page ? replying(page) : notFound(route);
  }

  if (route === '/api/title/sources') {
    const lines = SEARCH.map((message) => `${JSON.stringify(message)}\n`);

    return { reply: inPieces(lines), chars: lines.join('').length };
  }

  if (route === '/api/events') {
    const { reply, send } = anOpenStream(asked.init);
    const text = `data: ${JSON.stringify(SNAPSHOT)}\n\n`;
    send(text);

    return { reply, chars: text.length };
  }

  return notFound(route);
}

function notFound(route: string): Answer {
  const error = anError('not_found', `Nothing at ${route}`);

  return { reply: refusal(404, error), chars: JSON.stringify({ error }).length };
}

type Used = { requests: number; chars: number };

/** What a scenario asked of the engine, by route without its query. */
type Measured = { scenario: string; used: Map<string, Used> };

const measured: Measured[] = [];
let measuring: Map<string, Used> | null = null;

/** How long the engine takes to answer: long enough that a screen mounting meanwhile finds the request still on its way, as it would on a phone. */
const ANSWER_MS = 48;

/** Answers every request as `world`'s engine, after `ANSWER_MS`, counting each into the scenario being measured, if one is. */
function serve(world: World) {
  answer((asked) => {
    const [route = '', query = ''] = asked.address.slice(world.base.length).split('?');
    const { reply, chars } = engineAnswer(world, route, query, asked);

    if (measuring) {
      const before = measuring.get(route) ?? { requests: 0, chars: 0 };
      measuring.set(route, { requests: before.requests + 1, chars: before.chars + chars });
    }

    return new Promise<Reply>((resolve) => setTimeout(() => resolve(reply), ANSWER_MS));
  });
}

const keys = { ...keychain };
const disk = { ...shelf };

/** Keeps replies in memory, stamped with the test's clock, since the file system's stand-in stamps files with a counter instead of the time. */
function aShelfInMemory() {
  const shelved = new Map<string, { text: string; at: number }>();
  shelf.read = (name) => shelved.get(name);
  shelf.write = async (name, text) => {
    shelved.set(name, { text, at: Date.now() });
  };
}

beforeEach(() => {
  jest.useFakeTimers({ now: LAUNCHED_AT });
  aShelfInMemory();
});

afterEach(() => {
  Object.assign(keychain, keys);
  Object.assign(shelf, disk);
  measuring = null;
  jest.useRealTimers();
});

const FRAME_MS = 16;

/** Lets `ms` pass a frame at a time, so work that a timer starts on the way, such as a fetch that sets another timer, runs when it would on the phone rather than at the end. */
async function wait(ms: number) {
  for (let passed = 0; passed < ms; passed += FRAME_MS) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(Math.min(FRAME_MS, ms - passed));
    });
  }
}

/** Opens the app paired with `world`'s engine, on Home, as a launch does. Returns how to close it. */
async function launch(world: World) {
  const engine = { id: world.base, name: 'engine.test', kind: 'computer', link: { base: world.base, token: null } };
  const stored = JSON.stringify({ engines: [engine], active: engine.id });

  Object.assign(keychain, {
    get: async (key: string) => (key === 'engines' ? stored : null),
    set: async () => {},
    remove: async () => {},
  });

  serve(world);

  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ExpoRoot context={APP} location="/" />
    </SafeAreaProvider>,
  );

  await act(async () => {});

  return async () => {
    await view.unmount();
  };
}

/** Counts what `run` asks of the engine from when it calls `start`, and checks it against the scenario's budget. */
async function scenario(name: string, run: (start: () => void) => Promise<void>) {
  const used = new Map<string, Used>();
  measured.push({ scenario: name, used });
  await run(() => {
    measuring = used;
  });
  measuring = null;

  expect(overruns(name, used)).toEqual([]);

  return used;
}

const budgetOf = (name: string, route: string): Budget =>
  NETWORK.find((budget) => budget.scenario === name && budget.route === route) ?? {
    scenario: name,
    route,
    requests: 0,
    chars: 0,
  };

function routesOf(name: string, used: Map<string, Used>): string[] {
  const listed = NETWORK.filter((budget) => budget.scenario === name).map((budget) => budget.route);

  return [...new Set([...used.keys(), ...listed])].sort();
}

const over = (used: Used, budget: Budget) => used.requests > budget.requests || used.chars > budget.chars;

function overruns(name: string, used: Map<string, Used>): string[] {
  return routesOf(name, used).flatMap((route) => {
    const spent = used.get(route) ?? { requests: 0, chars: 0 };
    const budget = budgetOf(name, route);

    return over(spent, budget)
      ? [
          `${name}: ${route} was asked ${spent.requests} times for ${spent.chars} characters; its budget is ${budget.requests} for ${budget.chars}`,
        ]
      : [];
  });
}

/** The measurements as a markdown table, for CI's step summary. */
function report(): string {
  const rows = measured.flatMap(({ scenario: name, used }) =>
    routesOf(name, used).map((route) => {
      const spent = used.get(route) ?? { requests: 0, chars: 0 };
      const budget = budgetOf(name, route);
      const mark = over(spent, budget) ? '❌' : '✅';

      return `| ${mark} | ${name} | \`${route}\` | ${spent.requests} | ${spent.chars} | ${budget.requests} / ${budget.chars} |`;
    }),
  );

  return [
    '## Network budgets',
    '',
    'What each scenario asks of the engine, by route, against `mobile/src/perf/budgets.ts`.',
    '',
    '| | Scenario | Route | Requests | Characters | Budget (requests / characters) |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...rows,
    '',
  ].join('\n');
}

afterAll(() => {
  const path = process.env.TORRENTIAL_BUDGET_REPORT_PATH;

  if (!path) return;
  const files: { writeFileSync: (file: string, text: string) => void } = require('fs');
  files.writeFileSync(path, report());
});

const HOUR_MS = 60 * 60_000;

describe('what the app asks of the engine stays within its budget', () => {
  test('a first launch with saved shows asks for Home and each show’s page once', async () => {
    await scenario('first launch, saved shows', async (start) => {
      start();
      await launch(withSavedShows());
      await wait(3000);

      expect(screen.getByText('New episodes')).toBeOnTheScreen();
    });
  });

  test('a first launch with nothing saved asks for Home and what is popular once', async () => {
    await scenario('first launch, nothing saved', async (start) => {
      start();
      await launch(withNothingSaved());
      await wait(3000);

      expect(screen.getByText('Popular shows')).toBeOnTheScreen();
    });
  });

  test('a launch five hours after the last draws Home and New episodes from kept replies, asking only for Home', async () => {
    const world = withSavedShows();
    const quit = await launch(world);
    await wait(3000);
    await quit();

    await scenario('second launch 5 h later, saved shows', async (start) => {
      jest.setSystemTime(Date.now() + 5 * HOUR_MS);
      start();
      await launch(world);

      expect(screen.getByText(SHOW.name)).toBeOnTheScreen();

      await wait(3000);

      expect(screen.getByText('New episodes')).toBeOnTheScreen();
    });
  });

  test('a launch within the hour draws what is popular from the kept reply at once, without asking for it', async () => {
    const world = withNothingSaved();
    const quit = await launch(world);
    await wait(3000);
    await quit();

    await scenario('second launch 50 min later, nothing saved', async (start) => {
      jest.setSystemTime(Date.now() + (50 * HOUR_MS) / 60);
      start();
      await launch(world);

      expect(screen.getByText('Popular shows')).toBeOnTheScreen();

      await wait(3000);

      expect(screen.getByText('Popular shows')).toBeOnTheScreen();
    });
  });

  test('glancing at a title and leaving before 1.5 s searches no sources', async () => {
    await scenario('glancing at a title for 0.8 s', async (start) => {
      await launch(withNothingSaved());
      await wait(1000);
      start();
      await act(() => router.push({ pathname: '/title/[id]', params: { id: FILM.id } }));
      await wait(800);

      expect(screen.getByRole('header', { name: FILM.name })).toBeOnTheScreen();

      await fireEvent.press(screen.getByLabelText('Back'));
      await wait(3000);

      expect(screen.queryByRole('header', { name: FILM.name })).toBeNull();
    });
  });

  test('staying on a title searches its sources once', async () => {
    const used = await scenario('staying on a title for 2 s', async (start) => {
      await launch(withNothingSaved());
      await wait(1000);
      start();
      await act(() => router.push({ pathname: '/title/[id]', params: { id: FILM.id } }));
      await wait(2000);

      expect(screen.getByRole('header', { name: FILM.name })).toBeOnTheScreen();
    });

    expect(used.get('/api/title/sources')?.requests).toBe(1);
  });

  test('opening a show asks for its page once, though the press and the page both want it', async () => {
    await scenario('opening a show from Popular', async (start) => {
      await launch(withNothingSaved());
      await wait(1000);
      start();
      await fireEvent(screen.getByLabelText(new RegExp(`^${SHOW.name}`)), 'pressIn');
      await act(() => router.navigate({ pathname: '/title/[id]', params: { id: SHOW.id } }));
      await wait(1000);

      expect(screen.getByRole('header', { name: SHOW.name })).toBeOnTheScreen();
    });
  });

  test('every budget belongs to a scenario that ran', () => {
    const ran = new Set(measured.map((run) => run.scenario));

    expect(NETWORK.filter((budget) => !ran.has(budget.scenario))).toEqual([]);
  });
});
