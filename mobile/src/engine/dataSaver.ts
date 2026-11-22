import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

const stored = new File(Paths.document, 'data-saver');
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return !(stored.exists && stored.textSync().trim() === 'off');
  } catch {
    return true;
  }
}

let on = read();

/** Whether to ask for smaller videos on mobile data. On unless turned off in Settings. */
export function useDataSaver(): [boolean, (next: boolean) => void] {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => on,
  );
  const set = (next: boolean) => {
    on = next;
    const text = next ? 'on' : 'off';
    try {
      stored.writeSync(text);
    } catch {}
    for (const listener of listeners) listener();
  };
  return [current, set];
}
