import { File, Paths } from 'expo-file-system';

import { fromEngine, type Link } from './client';

/** A reply kept on disk and when it was written, in milliseconds since the epoch. */
export type Kept<T> = { data: T; at: number };

/** Where replies are kept between launches: files in the phone's cache in the app, memory in a test. `at` is when one was written, in milliseconds since the epoch. */
export const shelf = {
  read: (name: string): { text: string; at: number } | undefined => {
    const file = new File(Paths.cache, name);

    return file.exists ? { text: file.textSync(), at: file.lastModified ?? 0 } : undefined;
  },
  write: (name: string, text: string): Promise<void> => new File(Paths.cache, name).write(text),
};

function nameOf(link: Link, route: string): string {
  return `kept-${`${link.base}${route}`.replace(/[^a-z0-9]+/gi, '_')}.json`;
}

/**
 * The engine's last answer to `route`, read from disk at once, so a screen draws it on its first render while it asks
 * again. Undefined when nothing is kept or the file can't be read.
 */
export function keptReply<T>(link: Link, route: string): Kept<T> | undefined {
  try {
    const kept = shelf.read(nameOf(link, route));

    if (!kept) return undefined;

    return { data: fromEngine<T>(kept.text), at: kept.at };
  } catch {
    return undefined;
  }
}

/** Keeps the engine's answer to `route` for the next launch, without waiting for the disk. */
export function keepReply<T>(link: Link, route: string, data: T) {
  shelf.write(nameOf(link, route), JSON.stringify(data)).catch(() => {});
}

/** A query's `initialData` from the reply kept for `route`, read from disk only when the query is first made. Keep the fresh reply in its `queryFn` with `keepReply`. */
export function keptOptions<T>(link: Link, route: string) {
  let entry: Kept<T> | undefined | null = null;

  const read = () => {
    if (entry === null) entry = keptReply<T>(link, route);

    return entry;
  };

  return { initialData: () => read()?.data, initialDataUpdatedAt: () => read()?.at };
}
