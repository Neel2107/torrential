import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { SUBTITLE_STYLE, type SubtitleStyle } from '@web/lib/storage';

/** How the player was last set, kept on the phone as the web app keeps it in the browser. */
export type PlayerPreferences = { speed: number; subtitleStyle: SubtitleStyle };

const KEY = 'player-preferences';
const DEFAULTS: PlayerPreferences = { speed: 1, subtitleStyle: SUBTITLE_STYLE };

export function usePlayerPreferences(): [PlayerPreferences, (change: Partial<PlayerPreferences>) => void] {
  const [preferences, setPreferences] = useState(DEFAULTS);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => {
        if (!saved) return;
        const read = JSON.parse(saved) as Partial<PlayerPreferences>;
        setPreferences({ ...DEFAULTS, ...read, subtitleStyle: { ...SUBTITLE_STYLE, ...read.subtitleStyle } });
      })
      .catch(() => {});
  }, []);

  const change = useCallback((next: Partial<PlayerPreferences>) => {
    setPreferences((previous) => {
      const merged = { ...previous, ...next };
      SecureStore.setItemAsync(KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  }, []);

  return [preferences, change];
}
