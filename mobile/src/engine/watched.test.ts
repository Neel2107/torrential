import { beforeEach, describe, expect, test } from '@jest/globals';
import { File, Paths } from 'expo-file-system';

import { answer, json, LINK, refusal, type Asked } from '@/test/engine';
import { anError, aPosition } from '@/test/wire';
import type { Position } from '@web/wire';

import type { Link, Reply } from './client';
import { report, resend } from './watched';

const OTHER: Link = { base: 'http://other.test:47919', token: null };

const outage = (): Reply => {
  throw new TypeError('Network request failed');
};

const taken = (): Reply => json({ watched: {}, kept: true });

function sent(asked: Asked[]): Pick<Position, 'video' | 'position'>[] {
  return asked.map((request) => {
    // SAFETY: report and resend always send a JSON body, the position.
    const position = JSON.parse(String(request.init.body)) as Position;

    return { video: position.video, position: position.position };
  });
}

beforeEach(() => {
  const outbox = new File(Paths.document, 'unsent-positions.json');

  if (outbox.exists) outbox.delete();
});

describe('reporting where a video stopped', () => {
  test('positions kept during an outage all reach the engine once it is back', async () => {
    answer(outage);
    await report(LINK, aPosition({ video: 'tt0063350', position: 10 }));
    await report(LINK, aPosition({ video: 'tt1727587', position: 20 }));

    const asked = answer(taken);
    await resend(LINK);

    expect(sent(asked)).toEqual([
      { video: 'tt0063350', position: 10 },
      { video: 'tt1727587', position: 20 },
    ]);
  });

  test('positions sent once are not sent again', async () => {
    answer(outage);
    await report(LINK, aPosition({ video: 'tt0063350', position: 10 }));
    answer(taken);
    await resend(LINK);

    const asked = answer(taken);
    await resend(LINK);

    expect(asked).toEqual([]);
  });

  test('the next report that gets through also sends what was kept', async () => {
    answer(outage);
    await report(LINK, aPosition({ video: 'tt0063350', position: 10 }));

    const asked = answer(taken);
    await report(LINK, aPosition({ video: 'tt1727587', position: 20 }));

    expect(sent(asked)).toEqual([
      { video: 'tt1727587', position: 20 },
      { video: 'tt0063350', position: 10 },
    ]);
  });

  test('a position the engine refuses does not hold back the ones after it', async () => {
    answer(outage);
    await report(LINK, aPosition({ video: 'tt0063350', position: 10 }));
    await report(LINK, aPosition({ video: 'tt0000001', position: 20 }));
    await report(LINK, aPosition({ video: 'tt1727587', position: 30 }));

    const asked = answer(({ init }) =>
      String(init.body).includes('tt0000001') ? refusal(404, anError('not_found', 'No title tt0000001.')) : taken(),
    );

    await resend(LINK);
    await resend(LINK);

    expect(sent(asked)).toEqual([
      { video: 'tt0063350', position: 10 },
      { video: 'tt0000001', position: 20 },
      { video: 'tt1727587', position: 30 },
    ]);
  });

  test('a position the engine refuses when it is reported is not kept to send again', async () => {
    answer(() => refusal(400, anError('usage', 'position -1 is not a time in a video')));
    await report(LINK, aPosition({ position: -1 }));

    const asked = answer(taken);
    await resend(LINK);

    expect(asked).toEqual([]);
  });

  test.each([
    ['answers that it is down', () => refusal(503, anError('daemon_unavailable', 'The engine is starting.'))],
    ['no longer knows this phone', () => refusal(401, anError('not_paired', 'This phone is not paired.'))],
  ])('a position is kept when the engine %s', async (_, failing) => {
    answer(failing);
    await report(LINK, aPosition({ position: 10 }));

    const asked = answer(taken);
    await resend(LINK);

    expect(sent(asked)).toEqual([{ video: 'tt0063350', position: 10 }]);
  });

  test('only the latest position per video is kept', async () => {
    answer(outage);
    await report(LINK, aPosition({ video: 'tt0063350', position: 10 }));
    await report(LINK, aPosition({ video: 'tt0063350', position: 20 }));

    const asked = answer(taken);
    await resend(LINK);

    expect(sent(asked)).toEqual([{ video: 'tt0063350', position: 20 }]);
  });

  test('positions kept for one engine are sent only to that engine', async () => {
    answer(outage);
    await report(LINK, aPosition({ video: 'tt0063350', position: 10 }));
    await report(OTHER, aPosition({ video: 'tt1727587', position: 20 }));

    const asked = answer(taken);
    await resend(OTHER);

    expect(asked.map((request) => request.address)).toEqual([`${OTHER.base}/api/watched`]);
    expect(sent(asked)).toEqual([{ video: 'tt1727587', position: 20 }]);
  });
});
