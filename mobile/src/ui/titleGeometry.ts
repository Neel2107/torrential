import { color, radius, space } from '@/theme';

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

/** The ring and shadow that set a title page's poster off its banner. The flying poster wears the same ring as it lands. */
export const posterRing = {
  borderRadius: radius.md + RING,
  borderWidth: RING,
  borderColor: color.paper,
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
} as const;
