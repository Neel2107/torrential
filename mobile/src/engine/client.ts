import * as Device from 'expo-device';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';

import type { ErrorCode, Error as WireError } from '@web/wire';

/**
 * Where the engine is and how this phone proves it was paired. `token` is null when the engine is
 * reached over loopback (`adb reverse` during development), where it trusts the caller as the Mac.
 */
export type Link = { base: string; token: string | null };

export const PORT = 47919;
export const COOKIE = 'torrential_device';

/** Names this phone when it pairs: the engine calls a device after what its User-Agent says it runs on. */
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

  /** The engine no longer knows this phone: it was removed on the Mac, or never paired. */
  get unpaired(): boolean {
    return this.code === 'not_paired' || this.status === 303;
  }
}

/** Headers every request to the engine carries, the video player's included. */
export function authHeaders(link: Link): Record<string, string> {
  return link.token ? { Cookie: `${COOKIE}=${link.token}` } : {};
}

export function url(link: Link, path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return `${link.base}${path}${qs ? `?${qs}` : ''}`;
}

async function failure(response: Response): Promise<EngineError> {
  const text = await response.text().catch(() => '');
  let wire: WireError | null = null;
  try {
    wire = (JSON.parse(text) as { error?: WireError }).error ?? null;
  } catch {}
  return new EngineError(response.status, wire, text.trim() || `The engine answered ${response.status}.`);
}

async function send(link: Link, path: string, init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal }) {
  const headers: Record<string, string> = { ...authHeaders(link), Accept: 'application/json' };
  let body: string | undefined;
  if (init.method === 'POST') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body ?? {});
  }
  const response = await fetch(`${link.base}${path}`, {
    method: init.method,
    headers,
    body,
    signal: init.signal,
    redirect: 'manual',
  });
  if (!response.ok) throw await failure(response);
  return response;
}

export async function get<T>(link: Link, path: string, signal?: AbortSignal): Promise<T> {
  return (await send(link, path, { method: 'GET', signal })).json() as Promise<T>;
}

export async function post<T>(link: Link, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return (await send(link, path, { method: 'POST', body, signal })).json() as Promise<T>;
}

/** Reads a streamed body as lines, calling `onLine` for each one as it arrives. */
async function readLines(response: Response, onLine: (line: string) => void): Promise<void> {
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

/** An NDJSON answer (search, sources, title play), one message per line, in order. */
export async function stream<T>(
  link: Link,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal },
  onMessage: (message: T) => void,
): Promise<void> {
  const response = await send(link, path, init);
  await readLines(response, (line) => onMessage(JSON.parse(line) as T));
}

/** Server-sent events: each `data:` line is one JSON message. Returns when the server closes. */
export async function events<T>(link: Link, path: string, signal: AbortSignal, onMessage: (message: T) => void) {
  const response = await fetch(`${link.base}${path}`, {
    headers: { ...authHeaders(link), Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok) throw await failure(response);
  await readLines(response, (line) => {
    if (line.startsWith('data:')) onMessage(JSON.parse(line.slice(5)) as T);
  });
}

/**
 * Pairs this phone with the code the Mac shows. The engine answers with the device's token only in
 * `Set-Cookie`, so it is read from there and kept by the app, not by a cookie jar.
 */
export async function pair(base: string, code: string): Promise<string> {
  const response = await fetch(`${base}/api/pair`, {
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
