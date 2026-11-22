import { space } from '@/theme';

export const BANNER = 0.56;
export const OVERLAP = 56;
export const RISE = 64;
export const RING = 3;
export const POSTER = { width: 112, height: 168 };

export function bannerHeight(width: number): number {
  return Math.round(width * BANNER);
}

export function posterRect(width: number) {
  return { x: space.page + RING, y: bannerHeight(width) - OVERLAP - RISE + RING, ...POSTER };
}
