import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { readStored, recentSearches } from './stored';

const KEY = 'recent-searches';
const KEEP = 8;

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
    const q = query.trim();

    if (!q) return;
    setRecent((previous) => {
      const next = [q, ...previous.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, KEEP);
      SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});

      return next;
    });
  }, []);

  const forget = useCallback((query: string) => write(recent.filter((item) => item !== query)), [recent, write]);
  const clear = useCallback(() => write([]), [write]);

  return { recent, remember, forget, clear };
}
