import { createContext, use } from 'react';

import { color, stage, type Palette } from '@/theme';

/** True under the player, which stays dark whatever the theme. Its value never changes, so it never re-renders. */
export const Stage = createContext(false);

export const STAGE_DIFFERS = stage !== color;

export function useTone(): Palette {
  return use(Stage) ? stage : color;
}

/** Picks between two styles built once at module scope: the theme's and the player's. */
export function useStaged<T>(themed: T, staged: T): T {
  return use(Stage) ? staged : themed;
}
