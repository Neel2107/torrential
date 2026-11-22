import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SUBTITLE_STYLE, type SubtitleStyle } from '@web/lib/storage';

/** `subtitles` is the language last picked anywhere, or null for off; undefined until one is picked. */
export type PlayerPreferences = {
  speed: number;
  subtitleStyle: SubtitleStyle;
  subtitles?: string | null;
  /** Per show, by title ID: the subtitle language picked there (null for off), and the audio language. */
  shows?: Record<string, { subtitles?: string | null; audio?: string }>;
};

const KEY = 'player-preferences';
const DEFAULTS: PlayerPreferences = { speed: 1, subtitleStyle: SUBTITLE_STYLE };

export function usePlayerPreferences(): [PlayerPreferences, (change: Partial<PlayerPreferences>) => void] {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const changed = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (!saved || changed.current) return;
        const read = JSON.parse(saved) as Partial<PlayerPreferences>;
        setPreferences({ ...DEFAULTS, ...read, subtitleStyle: { ...SUBTITLE_STYLE, ...read.subtitleStyle } });
      })
      .catch(() => {});
  }, []);

  const change = useCallback((next: Partial<PlayerPreferences>) => {
    changed.current = true;
    setPreferences((previous) => {
      const merged = { ...previous, ...next };
      SecureStore.setItemAsync(KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  }, []);

  return [preferences, change];
}
