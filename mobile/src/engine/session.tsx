import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import type { Me } from '@web/wire';

import { LocalEngine } from '../../modules/torrential-engine';
import { get, pair as pairWithCode, PORT, type Link } from './client';

const KEY = 'engines';
const OLD_KEY = 'engine-link';

export type Engine = { id: string; name: string; kind: 'computer' | 'phone'; link: Link };
type Saved = { engines: Engine[]; active: string | null };

type Session = { state: 'loading' } | { state: 'unpaired' } | { state: 'paired'; link: Link; engine: Engine };

type SessionApi = {
  session: Session;
  engines: Engine[];
  pair: (base: string, code: string) => Promise<void>;
  connectOverUsb: () => Promise<void>;
  runOnPhone: () => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  relocate: (base: string) => Promise<void>;
  forget: (id?: string) => Promise<void>;
};

const Context = createContext<SessionApi | null>(null);

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

  useEffect(() => {
    const local = LocalEngine;
    if (engine?.kind !== 'phone' || !local) return;
    const start = () =>
      local
        .start()
        .then(({ port, secret }) => {
          const link = { base: `http://127.0.0.1:${port}`, token: secret };
          if (link.base === engine.link.base && link.token === engine.link.token) return;
          return change((now) => ({
            ...now,
            engines: now.engines.map((e) => (e.id === engine.id ? { ...e, link } : e)),
          }));
        })
        .catch(() => {});
    start();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
    });
    return () => subscription.remove();
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
      connectOverUsb: () => {
        const base = `http://127.0.0.1:${PORT}`;
        return add({ id: base, name: computerName(base), kind: 'computer', link: { base, token: null } });
      },
      runOnPhone: async () => {
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
      forget: (id) =>
        change((now) => {
          const gone = id ?? now.active;
          if (!now.engines.some((e) => e.id === gone)) return now;
          const rest = now.engines.filter((e) => e.id !== gone);
          return { engines: rest, active: now.active === gone ? (rest[0]?.id ?? null) : now.active };
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

export function useLink(): Link {
  const { session } = useSession();
  if (session.state !== 'paired') throw new Error('useLink before pairing');
  return session.link;
}

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
