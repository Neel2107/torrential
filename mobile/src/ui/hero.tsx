import { useIsFocused, usePreventRemove } from 'expo-router';
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  makeMutable,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { since } from '@/perf';
import { radius } from '@/theme';

import { Art } from './Art';
import { posterRect } from './titleGeometry';

export const HERO = Platform.OS === 'android';

type Rect = { x: number; y: number; width: number; height: number };
type Measurable = React.ComponentRef<typeof View>;

type Phase = 'opening' | 'open' | 'closing';
type Flight = {
  token: number;
  id: string;
  from: Rect;
  to: Rect;
  phase: Phase;
  shown: boolean;
  ready: boolean;
  source: () => Promise<Rect | null>;
};

const OPEN = { duration: 340, easing: Easing.bezier(0.2, 0, 0, 1) };
const CLOSE = { duration: 280, easing: Easing.bezier(0.3, 0, 0, 1) };
const FADE = { duration: 200, easing: Easing.out(Easing.quad) };
const DRAW_WITHIN = 80;
const MOUNT_WITHIN = 300;
const PAGE: [number, number] = [0.05, 0.7];

const progress = makeMutable(0);

let flight: Flight | null = null;
let tokens = 0;
let afterClose: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: Flight | null) {
  flight = next;
  for (const listener of listeners) listener();
}

function update(token: number, change: Partial<Flight> | null) {
  if (flight?.token !== token) return;
  set(change ? { ...flight, ...change } : null);
}

const useFlight = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => flight,
  );

function measure(view: Measurable | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}

function onScreen(rect: Rect | null): rect is Rect {
  const { height } = Dimensions.get('window');
  return !!rect && rect.y + rect.height > 0 && rect.y < height;
}

export function useHeroSource(id: string) {
  const ref = useRef<Measurable>(null);

  const open = async (navigate: () => void) => {
    if (!HERO) return navigate();
    if (flight && flight.phase !== 'open') return;
    const source = () => measure(ref.current);
    const from = await source();
    if (from) {
      progress.value = 0;
      tokens += 1;
      const to = posterRect(Dimensions.get('window').width);
      set({ token: tokens, id, from, to, phase: 'opening', shown: false, ready: false, source });
    } else {
      set(null);
    }
    navigate();
  };

  return { ref, open };
}

const Slot = createContext<RefObject<Measurable | null> | null>(null);

export function useHeroPage(id: string) {
  const slot = useRef<Measurable>(null);
  const flown = useSharedValue(HERO && flight?.id === id ? 1 : 0);
  const own = useSharedValue(HERO && flight?.id !== id ? 0 : 1);
  const leaving = useRef(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (HERO && !flown.value) own.value = withTiming(1, FADE);
  }, [flown, own]);

  const focused = useIsFocused();
  usePreventRemove(HERO && focused && !gone, ({ repeat }) => {
    if (leaving.current) return;
    leaving.current = true;
    const go = () => {
      setGone(true);
      repeat();
    };
    const current = flight;
    const fade = () => {
      if (current?.id === id) update(current.token, null);
      if (flown.value) own.value = interpolate(progress.value, PAGE, [0, 1], Extrapolation.CLAMP);
      flown.value = 0;
      own.value = withTiming(0, FADE, (done) => {
        if (done) runOnJS(go)();
      });
    };
    if (current?.id !== id || current.phase !== 'open') return fade();
    Promise.all([measure(slot.current), current.source()]).then(([to, from]) => {
      if (flight?.token !== current.token || !onScreen(to) || !onScreen(from)) return fade();
      afterClose = go;
      update(current.token, { from, to, phase: 'closing', shown: false, ready: true });
    });
  });

  const style = useAnimatedStyle(() => ({
    opacity: flown.value ? interpolate(progress.value, PAGE, [0, 1], Extrapolation.CLAMP) : own.value,
  }));

  return { style, Provider: Slot.Provider, slot };
}

/** Whether the page for `id` has finished flying in, so content below the fold can mount without stealing frames from the flight. Stays true once true. */
export function useLanded(id: string): boolean {
  const current = useFlight();
  const now = !HERO || current?.id !== id || current.phase === 'open';
  const [landed, setLanded] = useState(now);
  useEffect(() => {
    if (now) setLanded(true);
  }, [now]);
  return landed || now;
}

export function HeroTarget({ id, children }: { id: string; children: ReactNode }) {
  const slot = use(Slot);
  const current = useFlight();
  const hidden =
    HERO && current?.id === id && (current.phase === 'opening' || (current.phase === 'closing' && current.shown));
  return (
    <View
      ref={slot}
      collapsable={false}
      style={hidden ? styles.hidden : undefined}
      onLayout={() => {
        const now = flight;
        if (now?.id === id && now.phase === 'opening' && !now.ready) update(now.token, { ready: true });
      }}
    >
      {children}
    </View>
  );
}

export function HeroLayer() {
  const current = useFlight();
  if (!HERO || !current || current.phase === 'open') return null;
  return <Flying key={`${current.token}:${current.phase}`} flight={current} />;
}

function Flying({ flight: { token, id, from, to, phase, ready } }: { flight: Flight }) {
  const back = phase === 'closing';
  const visible = useSharedValue(0);
  const started = useRef(false);
  const [drawn, setDrawn] = useState(false);

  const start = () => {
    if (started.current) return;
    started.current = true;
    if (!back) since('open', 'tap to flight');
    visible.value = 1;
    update(token, { shown: true });
    progress.value = withTiming(back ? 0 : 1, back ? CLOSE : OPEN, (done) => {
      if (done) runOnJS(land)(token, back);
    });
  };

  useEffect(() => {
    if (ready && drawn) {
      const frame = requestAnimationFrame(start);
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(start, ready ? DRAW_WITHIN : MOUNT_WITHIN);
    return () => clearTimeout(timer);
  }, [ready, drawn]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const scale = interpolate(p, [0, 1], [from.width / to.width, 1]);
    const centerX = interpolate(p, [0, 1], [from.x + from.width / 2, to.x + to.width / 2]);
    const centerY = interpolate(p, [0, 1], [from.y + from.height / 2, to.y + to.height / 2]);
    return {
      opacity: visible.value,
      transform: [
        { translateX: centerX - (to.x + to.width / 2) },
        { translateY: centerY - (to.y + to.height / 2) },
        { scale },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[{ position: 'absolute', left: to.x, top: to.y, width: to.width, height: to.height }, style]}
      >
        <Art
          id={id}
          kind="poster"
          style={styles.poster}
          fade={false}
          placeholder={false}
          onDisplay={() => setDrawn(true)}
        />
      </Animated.View>
    </View>
  );
}

function land(token: number, back: boolean) {
  if (!back) return update(token, { phase: 'open' });
  update(token, null);
  afterClose?.();
  afterClose = null;
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  poster: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
});
