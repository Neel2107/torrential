import * as Device from 'expo-device';
import { File, type DownloadTask, type DownloadTaskOptions } from 'expo-file-system';
import { fetch, type FetchRequestInit } from 'expo/fetch';
import { Platform } from 'react-native';

import type { ErrorCode, Error as WireError } from '@web/wire';

import { net } from '@/perf';

export type Link = { base: string; token: string | null };

/** What the client reads from the engine's answer: expo/fetch's response, or one a test builds. */
export type Reply = Pick<Response, 'ok' | 'status' | 'headers' | 'text' | 'body'>;

/** What the app drives of a file download: expo-file-system's task, or one a test builds. */
export type Download = Pick<DownloadTask, 'state' | 'downloadAsync' | 'cancel'>;

/** How requests and file downloads reach the engine. The app sends them with expo/fetch and expo-file-system; a test answers them as the engine would. */
export type Transport = {
  fetch: (address: string, init: FetchRequestInit) => Promise<Reply>;
  download: (address: string, to: File, options: DownloadTaskOptions) => Download;
};

export const transport: Transport = {
  fetch,
  download: (address, to, options) => File.createDownloadTask(address, to, options),
};

export const PORT = 47919;
export const COOKIE = 'torrential_device';

const ANSWER_WITHIN_MS = 75_000;

export const USER_AGENT = `torrential-app (${Platform.OS === 'ios' ? (Device.deviceType === Device.DeviceType.TABLET ? 'iPad' : 'iPhone') : 'Android'}; ${Device.modelName ?? 'phone'})`;

export class EngineError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly hint: string | null;

  constructor(status: number, wire: WireError | null, fallback: string) {
    super(wire?.message ?? fallback);
    this.status = status;
    this.code = wire?.code ?? null;
    this.hint = wire?.hint ?? null;
  }

  get unpaired(): boolean {
    return this.code === 'not_paired' || this.status === 303;
  }

  /** The engine read the request and will refuse it again however often it is sent: a 4xx with its error envelope, other than not knowing this phone, which pairing again mends. */
  get final(): boolean {
    return this.code !== null && this.status >= 400 && this.status < 500 && !this.unpaired;
  }
}

export function authHeaders(link: Link): Record<string, string> {
  return link.token ? { Cookie: `${COOKIE}=${link.token}` } : {};
}

export function url(
  link: Link,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }

  const qs = search.toString();

  return `${link.base}${path}${qs ? `?${qs}` : ''}`;
}

/** The engine's reply as the type its route answers with. */
export function fromEngine<T>(text: string): T {
  // SAFETY: the engine is the only server these calls reach, and web/src/wire.ts is generated from the Rust types it serializes, so each route's JSON is that route's wire type.
  return JSON.parse(text) as T;
}

async function failure(response: Reply): Promise<EngineError> {
  const text = await response.text().catch(() => '');
  let wire: WireError | null = null;

  try {
    wire = fromEngine<{ error?: WireError }>(text).error ?? null;
  } catch {}

  return new EngineError(response.status, wire, text.trim() || `The engine answered ${response.status}.`);
}

/** Sends a request and reads its answer with `read`. Stopping `init.signal` stops it until `read` is done, the body too, so a stream ends when its caller leaves; the engine has 75 s to start answering. */
async function send<T>(
  link: Link,
  path: string,
  init: { method: 'GET' | 'POST'; body?: object; signal?: AbortSignal },
  read: (response: Reply) => Promise<T>,
): Promise<T> {
  const posting = init.method === 'POST';

  const headers = posting
    ? { ...authHeaders(link), Accept: 'application/json', 'Content-Type': 'application/json' }
    : { ...authHeaders(link), Accept: 'application/json' };

  const body = posting ? JSON.stringify(init.body ?? {}) : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANSWER_WITHIN_MS);
  const cancel = () => controller.abort();

  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', cancel);

  try {
    const response = await transport.fetch(`${link.base}${path}`, {
      method: init.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });

    clearTimeout(timer);

    if (!response.ok) throw await failure(response);

    return await read(response);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}

function readJson<T>(path: string, startedAt: number) {
  return async (response: Reply): Promise<T> => {
    const text = await response.text();
    net(path, text.length, startedAt);

    return fromEngine<T>(text);
  };
}

export async function get<T>(link: Link, path: string, signal?: AbortSignal): Promise<T> {
  return send(link, path, { method: 'GET', signal }, readJson<T>(path, performance.now()));
}

export async function post<T, B extends object = object>(
  link: Link,
  path: string,
  body: B,
  signal?: AbortSignal,
): Promise<T> {
  return send(link, path, { method: 'POST', body, signal }, readJson<T>(path, performance.now()));
}

async function readLines(response: Reply, onLine: (line: string) => void): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    for (const line of (await response.text()).split('\n')) if (line.trim()) onLine(line);

    return;
  }

  const decoder = new TextDecoder();
  let buffered = '';

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    let newline = buffered.indexOf('\n');

    while (newline >= 0) {
      const line = buffered.slice(0, newline).replace(/\r$/, '');
      buffered = buffered.slice(newline + 1);

      if (line.trim()) onLine(line);
      newline = buffered.indexOf('\n');
    }
  }

  if (buffered.trim()) onLine(buffered);
}

export async function stream<T>(
  link: Link,
  path: string,
  init: { method: 'GET' | 'POST'; body?: object; signal?: AbortSignal },
  onMessage: (message: T) => void,
): Promise<void> {
  const startedAt = performance.now();
  let chars = 0;
  await send(link, path, init, (response) =>
    readLines(response, (line) => {
      chars += line.length;
      onMessage(fromEngine<T>(line));
    }),
  );
  net(path, chars, startedAt);
}

export async function events<T>(link: Link, path: string, signal: AbortSignal, onMessage: (message: T) => void) {
  const response = await transport.fetch(`${link.base}${path}`, {
    headers: { ...authHeaders(link), Accept: 'text/event-stream' },
    signal,
  });

  if (!response.ok) throw await failure(response);
  await readLines(response, (line) => {
    if (line.startsWith('data:')) onMessage(fromEngine<T>(line.slice(5)));
  });
}

export async function pair(base: string, code: string): Promise<string> {
  const response = await transport.fetch(`${base}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ code }),
    credentials: 'omit',
  });

  if (!response.ok) throw await failure(response);
  const cookie = response.headers.get('set-cookie') ?? '';
  const token = new RegExp(`${COOKIE}=([0-9a-f]{64})`).exec(cookie)?.[1];

  if (!token) throw new EngineError(500, null, 'The engine paired this phone but sent no device token.');

  return token;
}
