import { File, Paths } from 'expo-file-system';

import { fromEngine, type Link } from './client';

/** A reply kept on disk and when it was written, in milliseconds since the epoch. */
export type Kept<T> = { data: T; at: number };

function fileOf(link: Link, route: string): File {
  return new File(Paths.cache, `kept-${`${link.base}${route}`.replace(/[^a-z0-9]+/gi, '_')}.json`);
}

/**
 * The engine's last answer to `route`, read from disk at once, so a screen draws it on its first render while it asks
 * again. Undefined when nothing is kept or the file can't be read.
 */
export function keptReply<T>(link: Link, route: string): Kept<T> | undefined {
  try {
    const file = fileOf(link, route);

    if (!file.exists) return undefined;

    return { data: fromEngine<T>(file.textSync()), at: file.lastModified ?? 0 };
  } catch {
    return undefined;
  }
}

/** Keeps the engine's answer to `route` for the next launch, without waiting for the disk. */
export function keepReply<T>(link: Link, route: string, data: T) {
  fileOf(link, route)
    .write(JSON.stringify(data))
    .catch(() => {});
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
