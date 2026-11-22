import { File, Paths } from 'expo-file-system';

import type { Position } from '@web/wire';

import { post, type Link } from './client';

const outbox = new File(Paths.document, 'unsent-positions.json');

function read(): Record<string, Position> {
  try {
    return outbox.exists ? (JSON.parse(outbox.textSync()) as Record<string, Position>) : {};
  } catch {
    return {};
  }
}

function write(unsent: Record<string, Position>) {
  try {
    if (Object.keys(unsent).length === 0) {
      if (outbox.exists) outbox.delete();
      return;
    }
    outbox.write(JSON.stringify(unsent));
  } catch {}
}

/** Sends where a video stopped; one the engine does not take is kept on the phone and sent again later. */
export async function report(link: Link, position: Position): Promise<void> {
  try {
    await post(link, '/api/watched', position);
  } catch {
    write({ ...read(), [position.video]: position });
    return;
  }
  await resend(link);
}

/** Sends the positions the engine missed, keeping any it still does not take. */
export async function resend(link: Link): Promise<void> {
  const unsent = read();
  const videos = Object.keys(unsent);
  if (videos.length === 0) return;
  for (const video of videos) {
    try {
      await post(link, '/api/watched', { ...unsent[video], starts: false });
      delete unsent[video];
    } catch {
      break;
    }
  }
  write(unsent);
}
