import { router } from 'expo-router';

import { minutesLeft } from '@web/lib/format';
import { episodeCode, episodeName } from '@web/titles/words';
import type { Continue } from '@web/wire';

export function progressOf(item: Continue): number | null {
  return item.resume_at !== null && item.duration ? item.resume_at / item.duration : null;
}

export function subtitleOf(item: Continue): string {
  if (item.episode) return `${episodeCode(item.episode)} · ${episodeName(item.episode)}`;

  return item.title.year ? String(item.title.year) : '';
}

export function remainingOf(item: Continue): string {
  if (item.resume_at !== null && item.duration) return minutesLeft(item.resume_at, item.duration);

  return item.episode ? 'Next episode' : 'Not started';
}

export function resume(item: Continue) {
  router.push({ pathname: '/play', params: { video: item.video } });
}
