import { describe, expect, test } from '@jest/globals';

import { answer, anOpenStream, inPieces, LINK, refusal } from '@/test/engine';
import { anError, aPlay, aRelease, aTitle } from '@/test/wire';
import type { PlayTitle } from '@web/wire';

import { followPlay, heard, STARTING, type PlayMessage, type Start } from './start';

const BODY: PlayTitle = {
  video: 'tt0063350',
  viewer: {
    width: 2400,
    height: 1080,
    scale: 3,
    playback: 'hevc',
    decoders: { h264: 'hardware', hevc: 'hardware', av1: 'no' },
  },
};

const TITLE = aTitle();
const RELEASE = aRelease({ id: 'r2' });
const PLAY = aPlay();

const resolved: PlayMessage = { type: 'resolved', video: 'tt0063350', title: TITLE, episode: null };
const searched: PlayMessage = { type: 'searched', found: 4, sources: [] };
const trying: PlayMessage = { type: 'trying', rank: 1, of: 4, release: RELEASE };
const playing: PlayMessage = { type: 'playing', video: 'tt0063350', release: RELEASE, play: PLAY, resume_at: 61 };

const lines = (messages: PlayMessage[]) => messages.map((message) => `${JSON.stringify(message)}\n`);

async function phases(reply: () => ReturnType<typeof inPieces>) {
  const shown: Start[] = [];
  answer(reply);
  await followPlay(LINK, BODY, new AbortController().signal, (start) => shown.push(start));

  return shown;
}

describe('where starting a title stands', () => {
  test('each message moves it on, keeping the title and the sources found', () => {
    const steps = [resolved, searched, trying, { type: 'check', check: 'file_list' } as const, playing];
    const states = [STARTING];

    for (const message of steps) states.push(heard(states[states.length - 1], message));

    expect(states.map((state) => state.start)).toEqual([
      { phase: 'finding', title: null, episode: null },
      { phase: 'finding', title: TITLE, episode: null },
      { phase: 'finding', title: TITLE, episode: null },
      { phase: 'trying', title: TITLE, episode: null, rank: 1, of: 4, release: RELEASE, check: null, found: 4 },
      { phase: 'trying', title: TITLE, episode: null, rank: 1, of: 4, release: RELEASE, check: 'file_list', found: 4 },
      { phase: 'ready', title: TITLE, episode: null, release: RELEASE, play: PLAY, resumeAt: 61 },
    ]);
  });

  test('a check before any source is tried changes nothing', () => {
    expect(heard(STARTING, { type: 'check', check: 'start' })).toBe(STARTING);
  });

  test('a skipped source changes nothing shown', () => {
    const trying1 = heard(STARTING, trying);

    expect(
      heard(trying1, { type: 'skipped', release: 'r2', reason: { reason: 'stalled', text: 'It stalled.' } }).start,
    ).toBe(trying1.start);
  });

  test('failing says what the engine said and how many sources it tried', () => {
    const failed = heard(heard(STARTING, resolved), {
      type: 'failed',
      error: anError('no_source', 'No source played.', { hint: 'Try another release.' }),
      tried: [
        { release: 'r1', reason: { reason: 'stalled', text: 'It stalled.' } },
        { release: 'r2', reason: { reason: 'no_video', text: 'No video in it.' } },
      ],
    });

    expect(failed.start).toEqual({
      phase: 'failed',
      title: TITLE,
      episode: null,
      message: 'No source played.',
      hint: 'Try another release.',
      tried: 2,
    });
  });
});

describe('following a title as it starts', () => {
  test('shows each phase as its line arrives, once each', async () => {
    const shown = await phases(() => inPieces(lines([resolved, searched, trying, playing])));

    expect(shown.map((start) => start.phase)).toEqual(['finding', 'trying', 'ready']);
  });

  test('a stream that ends without playing shows that the engine stopped answering', async () => {
    const shown = await phases(() => inPieces(lines([resolved, searched, trying])));

    expect(shown.at(-1)).toEqual({
      phase: 'failed',
      title: TITLE,
      episode: null,
      message: 'The engine stopped answering before a source played.',
      hint: null,
      tried: 0,
    });
  });

  test('a stream that ends after failing shows the engine’s failure, not another', async () => {
    const failed: PlayMessage = { type: 'failed', error: anError('no_source', 'No source played.'), tried: [] };
    const shown = await phases(() => inPieces(lines([resolved, failed])));

    expect(shown.map((start) => (start.phase === 'failed' ? start.message : start.phase))).toEqual([
      'finding',
      'No source played.',
    ]);
  });

  test('an engine that refuses shows its message and hint', async () => {
    const shown = await phases(() =>
      refusal(404, anError('not_found', 'No title tt0000001.', { hint: 'Search again.' })),
    );

    expect(shown).toEqual([
      { phase: 'failed', title: null, episode: null, message: 'No title tt0000001.', hint: 'Search again.', tried: 0 },
    ]);
  });

  test('a lost connection says the engine was lost', async () => {
    const shown = await phases(() => {
      throw new TypeError('Network request failed');
    });

    expect(shown.map((start) => (start.phase === 'failed' ? start.message : start.phase))).toEqual([
      'Lost the engine while starting the video.',
    ]);
  });

  test('leaving while it starts shows nothing more, not a failure', async () => {
    const leaving = new AbortController();
    const shown: Start[] = [];

    answer(({ init }) => {
      const { reply, send } = anOpenStream(init);
      send(lines([resolved])[0]);
      setTimeout(() => leaving.abort(), 0);

      return reply;
    });

    await followPlay(LINK, BODY, leaving.signal, (start) => shown.push(start));

    expect(shown.map((start) => start.phase)).toEqual(['finding']);
  });
});
