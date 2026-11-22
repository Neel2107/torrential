import { afterEach } from '@jest/globals';
import type { FetchRequestInit } from 'expo/fetch';

import { transport, type Link, type Reply } from '@/engine/client';
import type { Error as WireError } from '@web/wire';

/** What the client asked the engine for. */
export type Asked = { address: string; init: FetchRequestInit };

const sent = transport.fetch;

afterEach(() => {
  transport.fetch = sent;
});

export const LINK: Link = { base: 'http://engine.test:47919', token: null };

/** Answers every request the client makes, until the test ends, and keeps what was asked. */
export function answer(engine: (asked: Asked) => Reply | Promise<Reply>): Asked[] {
  const asked: Asked[] = [];

  transport.fetch = async (address, init) => {
    asked.push({ address, init });

    return engine({ address, init });
  };

  return asked;
}

/** A reply whose body arrives in these byte pieces, each read separately, as a slow connection delivers it. */
export function inBytes(pieces: Uint8Array[], status = 200): Reply {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(piece);

      controller.close();
    },
  });

  return new Response(body, { status });
}

/** A reply whose body arrives in these pieces of text, each read separately. */
export function inPieces(pieces: string[], status = 200): Reply {
  const encoder = new TextEncoder();

  return inBytes(
    pieces.map((piece) => encoder.encode(piece)),
    status,
  );
}

/** A JSON reply, as the engine answers a route. */
export function json<T>(value: T, status = 200): Reply {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The engine refusing a request with its error envelope. */
export function refusal(status: number, error: WireError): Reply {
  return json({ error }, status);
}
