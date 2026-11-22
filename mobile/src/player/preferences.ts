import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SUBTITLE_STYLE, type SubtitleStyle } from '@web/lib/storage';
import { NO_PREFERENCES, playerPreferences, readStored, type StoredPreferences } from '@/engine/stored';

/** What the player keeps, as stored, with a speed and a whole subtitle style always there. `subtitles` is the language last picked anywhere, or null for off; undefined until one is picked. `shows` holds, per show by title ID, the subtitle language picked there (null for off) and the audio language. */
export type PlayerPreferences = Omit<StoredPreferences, 'speed' | 'subtitleStyle'> & {
  speed: number;
  subtitleStyle: SubtitleStyle;
};

const KEY = 'player-preferences';
const DEFAULTS: PlayerPreferences = { speed: 1, subtitleStyle: SUBTITLE_STYLE };

/** The preferences a stored file holds, over the defaults: a subtitle style it only partly gives keeps the default for the rest, and a file that does not read gives the defaults. */
export function readPreferences(saved: string | null | undefined): PlayerPreferences {
  const read = readStored(playerPreferences, saved, NO_PREFERENCES);

  return { ...DEFAULTS, ...read, subtitleStyle: { ...SUBTITLE_STYLE, ...read.subtitleStyle } };
}

export function usePlayerPreferences(): [PlayerPreferences, (change: Partial<PlayerPreferences>) => void] {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const changed = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (!saved || changed.current) return;
        setPreferences(readPreferences(saved));
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
