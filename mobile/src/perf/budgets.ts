/** The most one scenario may ask of one engine route: how many requests, and how many characters they bring back. */
export type Budget = { scenario: string; route: string; requests: number; chars: number };

/**
 * What each scenario in `budgets.test.tsx` may ask of the engine, set at what it asked when the budget was written. A
 * route a scenario does not list may not be asked at all. Lowering a number is always fine; raising one, adding a route
 * to a scenario or dropping a scenario fails `scripts/guard.sh` unless the commit says why on a `Raises-ceiling:` line.
 */
export const NETWORK: Budget[] = [
  { scenario: 'first launch, saved shows', route: '/api/home', requests: 1, chars: 297 },
  { scenario: 'first launch, saved shows', route: '/api/title', requests: 2, chars: 1441 },
  { scenario: 'first launch, saved shows', route: '/api/tvs', requests: 1, chars: 21 },
  { scenario: 'first launch, saved shows', route: '/api/version', requests: 1, chars: 33 },
  { scenario: 'first launch, nothing saved', route: '/api/home', requests: 1, chars: 26 },
  { scenario: 'first launch, nothing saved', route: '/api/titles/popular', requests: 2, chars: 370 },
  { scenario: 'first launch, nothing saved', route: '/api/tvs', requests: 1, chars: 21 },
  { scenario: 'first launch, nothing saved', route: '/api/version', requests: 1, chars: 33 },
  { scenario: 'second launch 5 h later, saved shows', route: '/api/home', requests: 1, chars: 297 },
  { scenario: 'second launch 5 h later, saved shows', route: '/api/tvs', requests: 1, chars: 21 },
  { scenario: 'second launch 5 h later, saved shows', route: '/api/version', requests: 1, chars: 33 },
  { scenario: 'second launch 50 min later, nothing saved', route: '/api/home', requests: 1, chars: 26 },
  { scenario: 'second launch 50 min later, nothing saved', route: '/api/tvs', requests: 1, chars: 21 },
  { scenario: 'second launch 50 min later, nothing saved', route: '/api/version', requests: 1, chars: 33 },
  { scenario: 'glancing at a title for 0.8 s', route: '/api/title', requests: 1, chars: 440 },
  { scenario: 'staying on a title for 2 s', route: '/api/title', requests: 1, chars: 440 },
  { scenario: 'staying on a title for 2 s', route: '/api/title/sources', requests: 1, chars: 1217 },
  { scenario: 'opening a show from Popular', route: '/api/title', requests: 1, chars: 853 },
];
