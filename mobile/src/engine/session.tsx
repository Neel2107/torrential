import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import type { Me } from '@web/wire';

import { LocalEngine } from '../../modules/torrential-engine';
import { get, pair as pairWithCode, PORT, type Link } from './client';

/** Every engine this phone knows, and which one it watches from. */
const KEY = 'engines';
/** Where a phone that knew only one engine kept it. */
const OLD_KEY = 'engine-link';

/** An engine this phone can watch from: a computer it paired with, or the one inside this app. */
export type Engine = { id: string; name: string; kind: 'computer' | 'phone'; link: Link };
type Saved = { engines: Engine[]; active: string | null };

type Session = { state: 'loading' } | { state: 'unpaired' } | { state: 'paired'; link: Link; engine: Engine };

type SessionApi = {
  session: Session;
  engines: Engine[];
  /** Pairs with the engine at `base` using the code the computer shows, and watches from it. */
  pair: (base: string, code: string) => Promise<void>;
  /** Uses an engine reached over loopback, which trusts the caller without pairing (USB during development). */
  useLoopback: () => Promise<void>;
  /** Starts the engine inside this app and watches from it. */
  usePhone: () => Promise<void>;
  /** Watches from another known engine. */
  switchTo: (id: string) => Promise<void>;
  /** Points the current engine at its new address, keeping its token: it moved networks, not the pairing. */
  relocate: (base: string) => Promise<void>;
  /** Forgets the current engine and watches from the next one, if any. */
  forget: () => Promise<void>;
};

const Context = createContext<SessionApi | null>(null);

/** A computer's name for the list: its host, or USB for the development loopback. */
function computerName(base: string): string {
  const host = new URL(base).hostname;
  return host === '127.0.0.1' || host === 'localhost' ? 'Computer over USB' : host;
}

async function load(): Promise<Saved> {
  const saved = await SecureStore.getItemAsync(KEY);
  if (saved) return JSON.parse(saved) as Saved;
  const old = await SecureStore.getItemAsync(OLD_KEY);
  if (!old) return { engines: [], active: null };
  const link = JSON.parse(old) as Link;
  const engine: Engine = { id: link.base, name: computerName(link.base), kind: 'computer', link };
  return { engines: [engine], active: engine.id };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    load()
      .then(setSaved)
      .catch(() => setSaved({ engines: [], active: null }));
  }, []);

  // Every change reads the list as it is now and waits for the one before it, so a switch, a
  // pairing and an automatic forget that land together cannot write over each other.
  const latest = useRef<Saved | null>(null);
  latest.current = saved;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const change = useCallback((next: (now: Saved) => Saved) => {
    const run = queue.current.then(async () => {
      const now = latest.current ?? { engines: [], active: null };
      const saving = next(now);
      await SecureStore.setItemAsync(KEY, JSON.stringify(saving));
      await SecureStore.deleteItemAsync(OLD_KEY);
      latest.current = saving;
      setSaved(saving);
    });
    queue.current = run.catch(() => {});
    return run;
  }, []);

  const { engines, engine, session } = useMemo(() => {
    const engines = saved?.engines ?? [];
    const engine = engines.find((e) => e.id === saved?.active) ?? null;
    const session: Session = !saved
      ? { state: 'loading' }
      : engine
        ? { state: 'paired', link: engine.link, engine }
        : { state: 'unpaired' };
    return { engines, engine, session };
  }, [saved]);

  // The phone's engine runs in the app's process, so it starts again each time the app does, and
  // its link follows the port and secret it comes up with.
  useEffect(() => {
    if (engine?.kind !== 'phone' || !LocalEngine) return;
    LocalEngine.start()
      .then(({ port, secret }) => {
        const link = { base: `http://127.0.0.1:${port}`, token: secret };
        if (link.base === engine.link.base && link.token === engine.link.token) return;
        return change((now) => ({
          ...now,
          engines: now.engines.map((e) => (e.id === engine.id ? { ...e, link } : e)),
        }));
      })
      .catch(() => {});
  }, [engine, change]);

  const api = useMemo<SessionApi>(() => {
    const add = (next: Engine) =>
      change((now) => ({ engines: [...now.engines.filter((e) => e.id !== next.id), next], active: next.id }));
    return {
      session,
      engines,
      pair: async (base, code) => {
        const link = { base, token: await pairWithCode(base, code) };
        await add({ id: base, name: computerName(base), kind: 'computer', link });
      },
      useLoopback: () => {
        const base = `http://127.0.0.1:${PORT}`;
        return add({ id: base, name: computerName(base), kind: 'computer', link: { base, token: null } });
      },
      usePhone: async () => {
        if (!LocalEngine) throw new Error('This build cannot run the engine on the phone');
        // Android 13 and later show the engine's notification only with permission.
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS').catch(() => {});
        }
        const { port, secret } = await LocalEngine.start();
        const link = { base: `http://127.0.0.1:${port}`, token: secret };
        await add({ id: 'phone', name: 'This phone', kind: 'phone', link });
      },
      switchTo: (id) => change((now) => (now.engines.some((e) => e.id === id) ? { ...now, active: id } : now)),
      relocate: async (base) => {
        if (!engine) return;
        const link = { base, token: engine.link.token };
        await get<Me>(link, '/api/me');
        await change((now) => ({
          ...now,
          engines: now.engines.map((e) => (e.id === engine.id ? { ...e, name: computerName(base), link } : e)),
        }));
      },
      forget: () =>
        change((now) => {
          const rest = now.engines.filter((e) => e.id !== now.active);
          return { engines: rest, active: rest[0]?.id ?? null };
        }),
    };
  }, [session, engines, engine, change]);

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
