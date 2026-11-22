import { File, Paths } from 'expo-file-system';

import type { Position } from '@web/wire';

import { post, type Link } from './client';
import { readStored, unsentPositions } from './stored';

type Unsent = Record<string, Record<string, Position>>;

const outbox = new File(Paths.document, 'unsent-positions.json');
let line: Promise<void> = Promise.resolve();

function read(): Unsent {
  try {
    return readStored(unsentPositions, outbox.exists ? outbox.textSync() : null, {});
  } catch {
    return {};
  }
}

function write(unsent: Unsent) {
  try {
    const kept = Object.fromEntries(Object.entries(unsent).filter(([, videos]) => Object.keys(videos).length > 0));

    if (Object.keys(kept).length === 0) {
      if (outbox.exists) outbox.delete();

      return;
    }

    outbox.writeSync(JSON.stringify(kept));
  } catch {}
}

function queued(task: () => Promise<void>): Promise<void> {
  line = line.then(task, task);

  return line;
}

function hold(engine: string, position: Position) {
  const unsent = read();
  unsent[engine] = { ...unsent[engine], [position.video]: position };
  write(unsent);
}

async function flush(link: Link) {
  for (const position of Object.values(read()[link.base] ?? {})) {
    try {
      await post(link, '/api/watched', { ...position, starts: false });
    } catch {
      return;
    }

    const unsent = read();

    if (unsent[link.base]?.[position.video] === undefined) continue;

    if (JSON.stringify(unsent[link.base][position.video]) !== JSON.stringify(position)) continue;
    delete unsent[link.base][position.video];
    write(unsent);
  }
}

/** Sends where a video stopped, one report at a time. One the engine does not take is kept on the phone for that engine, the latest per video, and sent again later. */
export function report(link: Link, position: Position): Promise<void> {
  return queued(async () => {
    const unsent = read();

    if (unsent[link.base]?.[position.video]) {
      delete unsent[link.base][position.video];
      write(unsent);
    }

    try {
      await post(link, '/api/watched', position);
    } catch {
      hold(link.base, position);

      return;
    }

    await flush(link);
  });
}

/** Sends the positions this engine missed, keeping any it still does not take. */
export function resend(link: Link): Promise<void> {
  return queued(() => flush(link));
}
