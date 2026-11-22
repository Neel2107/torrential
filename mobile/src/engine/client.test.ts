import { describe, expect, test } from '@jest/globals';

import { answer, inBytes, inPieces, LINK, refusal } from '@/test/engine';
import { aJob, anError } from '@/test/wire';
import type { Event, Job } from '@web/wire';

import { EngineError, events, get, stream } from './client';

const NEVER = new AbortController().signal;

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function heard<T>(read: (onMessage: (message: T) => void) => Promise<void>): Promise<T[]> {
  const messages: T[] = [];

  await read((message) => messages.push(message));

  return messages;
}

const eventsFrom = (path: string) => (onMessage: (message: Event) => void) => events(LINK, path, NEVER, onMessage);

const linesFrom = (path: string) => (onMessage: (message: Job) => void) =>
  stream(LINK, path, { method: 'GET' }, onMessage);

describe('reading what the engine streams', () => {
  test('an event cut in two mid-line arrives once, whole', async () => {
    const line = `data: ${JSON.stringify({ event: 'removed', id: 'a1' })}\n\n`;
    answer(() => inPieces([line.slice(0, 15), line.slice(15)]));

    expect(await heard(eventsFrom('/api/events'))).toEqual([{ event: 'removed', id: 'a1' }]);
  });

  test('a name cut in the middle of a character arrives unbroken', async () => {
    const job = aJob({ name: 'Sintel — 2010 · été' });
    const encoded = bytes(`${JSON.stringify(job)}\n`);
    const dash = encoded.indexOf(0xe2);
    answer(() => inBytes([encoded.slice(0, dash + 1), encoded.slice(dash + 1)]));

    expect((await heard(linesFrom('/api/jobs/a1/watch'))).map((heardJob) => heardJob.name)).toEqual([
      'Sintel — 2010 · été',
    ]);
  });

  test('lines that end in CRLF read the same as lines that end in LF', async () => {
    const removed = (id: string) => `data: ${JSON.stringify({ event: 'removed', id })}`;
    answer(() => inPieces([`${removed('a1')}\r\n\r\n${removed('a2')}\r\n\r\n`]));

    expect(await heard(eventsFrom('/api/events'))).toEqual([
      { event: 'removed', id: 'a1' },
      { event: 'removed', id: 'a2' },
    ]);
  });

  test('a last line with no newline after it still arrives', async () => {
    answer(() => inPieces([`${JSON.stringify(aJob({ id: 'a1' }))}\n`, JSON.stringify(aJob({ id: 'a2' }))]));

    expect((await heard(linesFrom('/api/jobs'))).map((job) => job.id)).toEqual(['a1', 'a2']);
  });

  test('comments, event names and blank lines in an event stream are not messages', async () => {
    answer(() =>
      inPieces([': keep-alive\n', 'event: job\n', `data: ${JSON.stringify({ event: 'heartbeat', at: 7 })}\n\n`]),
    );

    expect(await heard(eventsFrom('/api/events'))).toEqual([{ event: 'heartbeat', at: 7 }]);
  });
});

describe('when the engine says no', () => {
  test('its error envelope becomes an EngineError with the code, message and hint', async () => {
    answer(() =>
      refusal(404, anError('not_found', 'No download is called a9.', { hint: 'Pull to refresh the list.' })),
    );

    const refused = get(LINK, '/api/jobs/a9');

    await expect(refused).rejects.toBeInstanceOf(EngineError);
    await expect(refused).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'No download is called a9.',
      hint: 'Pull to refresh the list.',
    });
  });

  test('an event stream it refuses rejects with the envelope’s message', async () => {
    answer(() => refusal(401, anError('not_paired', 'This phone is not paired.')));

    await expect(eventsFrom('/api/events')(() => {})).rejects.toMatchObject({
      code: 'not_paired',
      unpaired: true,
      message: 'This phone is not paired.',
    });
  });

  test('a reply that is not an envelope keeps its text as the message', async () => {
    answer(() => new Response('Bad Gateway\n', { status: 502 }));

    await expect(get(LINK, '/api/jobs')).rejects.toMatchObject({ status: 502, code: null, message: 'Bad Gateway' });
  });

  test('an empty refusal says what the engine answered', async () => {
    answer(() => new Response(null, { status: 500 }));

    await expect(get(LINK, '/api/jobs')).rejects.toMatchObject({ message: 'The engine answered 500.' });
  });
});
