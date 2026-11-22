import { afterEach } from '@jest/globals';
import type { DownloadTaskState } from 'expo-file-system';
import type { FetchRequestInit } from 'expo/fetch';

import { transport, type Link, type Reply } from '@/engine/client';
import type { Error as WireError } from '@web/wire';

/** What the client asked the engine for. */
export type Asked = { address: string; init: FetchRequestInit };

const sent = transport.fetch;
const downloaded = transport.download;

afterEach(() => {
  transport.fetch = sent;
  transport.download = downloaded;
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

/** Serves every file the app downloads, until the test ends, writing what `engine` gives for its address where the app asked, and keeps the addresses asked for. A download stays open until `engine`'s promise settles, and fails when it rejects. */
export function serve(engine: (address: string) => string | Promise<string>): string[] {
  const asked: string[] = [];

  transport.download = (address, to) => {
    asked.push(address);
    let state: DownloadTaskState = 'idle';
    const cancelled = () => state === 'cancelled';

    return {
      get state() {
        return state;
      },
      cancel: () => {
        state = 'cancelled';
      },
      downloadAsync: async () => {
        state = 'active';

        try {
          const body = await engine(address);

          if (cancelled()) throw new Error('The download was cancelled.');
          to.write(body);
          state = 'completed';

          return to;
        } catch (error) {
          if (!cancelled()) state = 'error';
          throw error;
        }
      },
    };
  };

  return asked;
}
