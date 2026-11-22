import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { readStored, recentSearches } from './stored';

const KEY = 'recent-searches';
const KEEP = 8;

/** The recent searches after `query` is searched: newest first, trimmed, once each whatever its case, at most 8. A blank query changes nothing. */
export function remembered(previous: string[], query: string): string[] {
  const q = query.trim();

  if (!q) return previous;

  return [q, ...previous.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, KEEP);
}

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => setRecent(readStored(recentSearches, saved, [])))
      .catch(() => {});
  }, []);

  const write = useCallback((next: string[]) => {
    setRecent(next);
    SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const remember = useCallback((query: string) => {
    if (!query.trim()) return;
    setRecent((previous) => {
      const next = remembered(previous, query);
      SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});

      return next;
    });
  }, []);

  const forget = useCallback((query: string) => write(recent.filter((item) => item !== query)), [recent, write]);
  const clear = useCallback(() => write([]), [write]);

  return { recent, remember, forget, clear };
}
