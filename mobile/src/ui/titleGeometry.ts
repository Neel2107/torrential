import { space } from '@/theme';

/**
 * Where the title page draws its banner and poster. The poster's flight from a card lands on this
 * spot before the page has laid out, so the page and the flight read it from here.
 */
export const BANNER = 0.56;
/** How far the page's sheet comes up over the banner. */
export const OVERLAP = 56;
/** How far the poster rises above the sheet. */
export const RISE = 64;
/** The paper ring around the poster. */
export const RING = 3;
export const POSTER = { width: 112, height: 168 };

export function bannerHeight(width: number): number {
  return Math.round(width * BANNER);
}

/** The poster's picture on a title page scrolled to the top, in window points. */
export function posterRect(width: number) {
  return { x: space.page + RING, y: bannerHeight(width) - OVERLAP - RISE + RING, ...POSTER };
}
