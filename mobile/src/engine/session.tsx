import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Me } from '@web/wire';

import { get, pair as pairWithCode, PORT, type Link } from './client';

const KEY = 'engine-link';

type Session = { state: 'loading' } | { state: 'unpaired' } | { state: 'paired'; link: Link };

type SessionApi = {
  session: Session;
  /** Pairs with the engine at `base` using the code the Mac shows, and keeps the link. */
  pair: (base: string, code: string) => Promise<void>;
  /** Uses an engine reached over loopback, which trusts the caller without pairing (USB during development). */
  useLoopback: () => Promise<void>;
  /** Points a paired phone at the engine's new address, keeping its token: the engine moved networks, not the pairing. */
  relocate: (base: string) => Promise<void>;
  forget: () => Promise<void>;
};

const Context = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => setSession(saved ? { state: 'paired', link: JSON.parse(saved) as Link } : { state: 'unpaired' }))
      .catch(() => setSession({ state: 'unpaired' }));
  }, []);

  const keep = useCallback(async (link: Link) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(link));
    setSession({ state: 'paired', link });
  }, []);

  const api = useMemo<SessionApi>(
    () => ({
      session,
      pair: async (base, code) => keep({ base, token: await pairWithCode(base, code) }),
      useLoopback: () => keep({ base: `http://127.0.0.1:${PORT}`, token: null }),
      relocate: async (base) => {
        if (session.state !== 'paired') return;
        const link = { base, token: session.link.token };
        await get<Me>(link, '/api/me');
        await keep(link);
      },
      forget: async () => {
        await SecureStore.deleteItemAsync(KEY);
        setSession({ state: 'unpaired' });
      },
    }),
    [session, keep],
  );

  return <Context value={api}>{children}</Context>;
}

export function useSession(): SessionApi {
  const api = use(Context);
  if (!api) throw new Error('useSession outside SessionProvider');
  return api;
}

/** The link of a paired session. Screens under the paired layout can rely on it. */
export function useLink(): Link {
  const { session } = useSession();
  if (session.state !== 'paired') throw new Error('useLink before pairing');
  return session.link;
}

/**
 * Reads a pairing link or what a person typed: `http://mac.local:47919/pair#123456`, a bare
 * address such as `192.168.1.20`, or `mac.local:47919`. Returns the engine's base URL and the code
 * when the link carries one.
 */
export function parsePairing(input: string): { base: string; code: string | null } | null {
  const text = input.trim();
  if (!text) return null;
  const bareIpv6 = /^[0-9a-f:]+$/i.test(text) && text.split(':').length > 2;
  const host = bareIpv6 ? `[${text}]` : text;
  const withScheme = /^https?:\/\//i.test(host) ? host : `http://${host}`;
  try {
    const parsed = new URL(withScheme);
    const code = /^#?(\d{6})$/.exec(parsed.hash)?.[1] ?? null;
    const port = parsed.port || (parsed.protocol === 'https:' ? '' : String(PORT));
    const base = `${parsed.protocol}//${parsed.hostname}${port ? `:${port}` : ''}`;
    return { base, code };
  } catch {
    return null;
  }
}
