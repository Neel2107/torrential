import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { bytes } from '@web/lib/format';
import { fileName, fileUrl, savedVideo } from '@web/lib/release';
import type { FilesReply, OnlineSubtitles } from '@web/wire';

import { authHeaders, get, post, transport, url, type Download, type Link } from '@/engine/client';
import { languageName, sameLanguage } from '@/player/languages';
import {
  NO_PREFERENCES,
  playerPreferences,
  readStored,
  savedCopies,
  type SavedCopies,
  type StoredLabel,
} from '@/engine/stored';

export type Label = StoredLabel;

/** A download's video copied to this phone. `file` is the file asked for, by index, kept in every state so trying again copies the same one; none means the largest video. */
export type Copy = { job: string; label: Label; size: number; file?: number } & (
  | { state: 'saving'; written: number }
  | { state: 'failed'; error: string }
  | { state: 'saved'; saved_at: number; uri: string; subtitles?: string }
);

type Saved = Extract<Copy, { state: 'saved' }>;

const KEEP_FREE = 512 * 1024 * 1024;
const PROGRESS_MS = 250;

const folder = new Directory(Paths.document, 'offline');
const manifest = new File(folder, 'saved.json');

let copies: ReadonlyMap<string, Copy> = new Map();
let loaded = false;
const listeners = new Set<() => void>();
const tasks = new Map<string, Download>();

function publish(next: Map<string, Copy>) {
  copies = next;

  for (const listener of listeners) listener();
}

function put(copy: Copy) {
  publish(new Map(copies).set(copy.job, copy));
}

function drop(job: string) {
  const next = new Map(copies);
  next.delete(job);
  publish(next);
}

function keep() {
  const saved: SavedCopies = [...copies.values()].filter((copy): copy is Saved => copy.state === 'saved');

  try {
    if (!manifest.exists) manifest.create({ intermediates: true });
    manifest.writeSync(JSON.stringify(saved));
  } catch {}
}

/** Reads the saved manifest and clears copies cut off mid-download, once, before anything reads or changes the copies: after that, a .part file is a copy in progress. */
function load() {
  if (loaded) return;
  loaded = true;

  try {
    if (!folder.exists) return;

    for (const entry of folder.list()) if (entry instanceof File && entry.name.endsWith('.part')) entry.delete();

    if (!manifest.exists) return;
    const saved = readStored(savedCopies, manifest.textSync(), []).filter((copy) => new File(copy.uri).exists);
    publish(new Map(saved.map((copy) => [copy.job, copy])));
  } catch {}
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useCopies(): Copy[] {
  const all = useSyncExternalStore(subscribe, () => copies);

  return [...all.values()].sort((a, b) => order(b) - order(a));
}

function order(copy: Copy): number {
  return copy.state === 'saved' ? copy.saved_at : Number.MAX_SAFE_INTEGER;
}

/** The copy of `job` as it stands now, outside React. */
export function copyOf(job: string): Copy | undefined {
  load();

  return copies.get(job);
}

export function useCopy(job: string): Copy | undefined {
  return useSyncExternalStore(subscribe, () => copies).get(job);
}

/** How much room the phone has for copies, in bytes, or null when it will not say. The app asks expo-file-system; a test says how much. */
export const disk = {
  free: (): number | null => {
    try {
      return Paths.availableDiskSpace;
    } catch {
      return null;
    }
  },
};

export function freeSpace(): number | null {
  return disk.free();
}

const claimed = new Set<string>();

/** Copies a finished download's video to this phone; `file` picks which video when the download holds several. */
export async function save(link: Link, job: string, label: Label, file?: number): Promise<void> {
  load();
  const before = copies.get(job);

  if (claimed.has(job) || before?.state === 'saving' || before?.state === 'saved') return;
  claimed.add(job);

  try {
    await copy(link, job, label, file);
  } finally {
    claimed.delete(job);
  }
}

/** Tries a failed copy again, of the file it was asked for. */
export function retry(link: Link, failed: Copy): Promise<void> {
  return save(link, failed.job, failed.label, failed.file);
}

async function copy(link: Link, job: string, label: Label, index?: number): Promise<void> {
  const fail = (error: string) => put({ job, label, size: 0, file: index, state: 'failed', error });

  let reply: FilesReply;

  try {
    reply = await post<FilesReply>(link, '/api/files', { ref: job });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not reach the engine.');
  }

  const file =
    (index === undefined ? null : reply.files.find((candidate) => candidate.index === index)) ??
    savedVideo(reply.files);

  if (!file) return fail('This download has no video to save.');
  const free = freeSpace();

  if (free !== null && file.size > free - KEEP_FREE) {
    return fail(`It needs ${bytes(file.size)}, and this phone has ${bytes(Math.max(0, free - KEEP_FREE))} to spare.`);
  }

  const name = fileName(file.path);
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const part = new File(folder, `${job}.part`);
  const size = file.size;

  try {
    if (!folder.exists) folder.create({ intermediates: true });

    if (part.exists) part.delete();
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'The phone would not make room for the file.');
  }

  put({ job, label, size, file: index, state: 'saving', written: 0 });
  let shown = 0;
  let task: Download | null = null;

  try {
    task = transport.download(url(link, fileUrl(job, file)), part, {
      headers: authHeaders(link),
      onProgress: ({ bytesWritten }) => {
        const now = Date.now();

        if (now - shown < PROGRESS_MS || copies.get(job)?.state !== 'saving') return;
        shown = now;
        put({ job, label, size, file: index, state: 'saving', written: bytesWritten });
      },
    });
    tasks.set(job, task);
    await task.downloadAsync();
    const whole = `${job}${extension}`;
    const target = new File(folder, whole);

    if (target.exists) target.delete();
    part.rename(whole);
    const subtitles = await keepSubtitles(link, job, file.index, reply, label.poster).catch(() => null);
    put({
      job,
      label,
      size,
      file: index,
      state: 'saved',
      saved_at: Date.now() / 1000,
      uri: target.uri,
      subtitles: subtitles ?? undefined,
    });
    keep();
  } catch (error) {
    try {
      if (part.exists) part.delete();
    } catch {}

    if (task?.state === 'cancelled') drop(job);
    else fail(error instanceof Error ? error.message : 'The copy stopped.');
  } finally {
    tasks.delete(job);
  }
}

const SUBTITLE_FILE = /\.(srt|vtt|ass|ssa)$/i;

/** The subtitle language the player keeps for this show, or the last one picked anywhere. */
async function wantedLanguage(title: string | null): Promise<string | null> {
  const saved = await SecureStore.getItemAsync('player-preferences').catch(() => null);

  if (!saved) return null;

  const preferences = readStored(playerPreferences, saved, NO_PREFERENCES);

  const own = title ? preferences.shows?.[title] : undefined;

  return (own && 'subtitles' in own ? own.subtitles : preferences.subtitles) ?? null;
}

/** Keeps beside the copy a subtitle file in the language the player remembers: the torrent's own first, then one found online. */
async function keepSubtitles(
  link: Link,
  job: string,
  video: number,
  reply: FilesReply,
  title: string | null,
): Promise<string | null> {
  const language = await wantedLanguage(title);

  if (!language) return null;

  const own = reply.files.find(
    (candidate) =>
      SUBTITLE_FILE.test(candidate.path) &&
      new RegExp(`\\b(${language}|${languageName(language) ?? language})\\b`, 'i').test(candidate.path),
  );

  let address: string | null = own ? url(link, '/api/subtitles', { id: job, file: own.index }) : null;

  if (!address) {
    const online = await get<OnlineSubtitles>(link, `/api/subtitles/online?id=${job}&file=${video}`);

    const match = [...online.subtitles]
      .sort((a, b) => Number(b.exact) - Number(a.exact))
      .find((subtitle) => sameLanguage(subtitle.language, language));

    if (!match) return null;
    address = url(link, '/api/subtitles/online/fetch', { id: job, file: video, subtitle: match.id });
  }

  const response = await fetch(address, { headers: authHeaders(link) });

  if (!response.ok) return null;
  const text = await response.text();

  if (!text.trim()) return null;
  const target = new File(folder, `${job}.vtt`);
  target.writeSync(text);

  return target.uri;
}

export function cancel(job: string) {
  tasks.get(job)?.cancel();
}

export function remove(job: string) {
  load();
  const copy = copies.get(job);

  if (copy?.state === 'saving') return cancel(job);

  if (copy?.state === 'saved') {
    for (const uri of [copy.uri, copy.subtitles]) {
      if (!uri) continue;

      try {
        const file = new File(uri);

        if (file.exists) file.delete();
      } catch {}
    }
  }

  drop(job);
  keep();
}
