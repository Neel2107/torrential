import { useIsFocused, useNavigation, usePreventRemove, type NativeStackNavigationProp } from 'expo-router';
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

import { radius } from '@/theme';

import { Art } from './Art';
import { posterRect } from './titleGeometry';

/**
 * A poster that carries across from a card to its title page, as a view transition carries a named
 * element: one picture moves from its place in the list to its place on the page while the page
 * fades in around it on the same clock, and both run backwards on the way out. iOS does this
 * natively with Apple's zoom transition (Link.AppleZoom); this is the Android one, and the title
 * route there has no animation of its own.
 */
export const HERO = Platform.OS === 'android';

type Rect = { x: number; y: number; width: number; height: number };
type Measurable = React.ComponentRef<typeof View>;

/** `opening` and `closing` are in the air; `open` has landed and remembers the way home. */
type Phase = 'opening' | 'open' | 'closing';
type Flight = {
  token: number;
  id: string;
  from: Rect;
  to: Rect;
  phase: Phase;
  /** The copy has drawn, so the page's poster may hide under it. */
  shown: boolean;
  /** Measures the card again, for the way home. Null once the card is gone. */
  source: () => Promise<Rect | null>;
};

const OPEN = { duration: 340, easing: Easing.bezier(0.2, 0, 0, 1) };
const CLOSE = { duration: 280, easing: Easing.bezier(0.3, 0, 0, 1) };
const FADE = { duration: 200, easing: Easing.out(Easing.quad) };
/** How long the copy may take to draw before it moves anyway. */
const DRAW_WITHIN = 80;
/** Where on the clock the page fades in. */
const PAGE: [number, number] = [0.05, 0.7];

/** The one clock: 0 on the card, 1 on the page. The copy and the page's opacity both read it. */
const progress = makeMutable(0);

let flight: Flight | null = null;
let tokens = 0;
/** What to do when the copy lands home: let the page go. */
let afterClose: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: Flight | null) {
  flight = next;
  for (const listener of listeners) listener();
}

/** Changes the flight only if it is still the one `token` names, so a stale callback cannot touch a newer flight. */
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

/** A card's poster. `open` measures it, starts the flight toward the page's poster, and navigates. */
export function useHeroSource(id: string) {
  const ref = useRef<Measurable>(null);

  const open = async (navigate: () => void) => {
    if (!HERO) return navigate();
    // One flight at a time: a second tap while one is in the air does nothing.
    if (flight && flight.phase !== 'open') return;
    const source = () => measure(ref.current);
    const from = await source();
    if (from) {
      progress.value = 0;
      tokens += 1;
      const to = posterRect(Dimensions.get('window').width);
      set({ token: tokens, id, from, to, phase: 'opening', shown: false, source });
    } else {
      set(null);
    }
    navigate();
  };

  return { ref, open };
}

const Slot = createContext<RefObject<Measurable | null> | null>(null);

/**
 * The title page's side: its opacity, on the flight's clock when it was flown to and its own fade
 * when it was not, and the way back, which flies the poster home before the page goes.
 */
export function useHeroPage(id: string) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const slot = useRef<Measurable>(null);
  const flown = useSharedValue(HERO && flight?.id === id ? 1 : 0);
  const own = useSharedValue(HERO && flight?.id !== id ? 0 : 1);
  const leaving = useRef(false);
  // The removal held back while the page leaves, sent again once the guard below is off: sent while
  // it is on, the guard would catch it again and the invisible page would stay over everything.
  const [release, setRelease] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);
  useEffect(() => {
    if (release) navigation.dispatch(release);
  }, [navigation, release]);

  useEffect(() => {
    if (HERO && !flown.value) own.value = withTiming(1, FADE);
  }, [flown, own]);

  // Only while this page is in front: a Back from the player above it is the player's to take.
  const focused = useIsFocused();
  usePreventRemove(HERO && focused && !release, ({ data }) => {
    if (leaving.current) return;
    leaving.current = true;
    const go = () => setRelease(data.action);
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
      update(current.token, { from, to, phase: 'closing', shown: false });
    });
  });

  const style = useAnimatedStyle(() => ({
    opacity: flown.value ? interpolate(progress.value, PAGE, [0, 1], Extrapolation.CLAMP) : own.value,
  }));

  return { style, Provider: Slot.Provider, slot };
}

/** The page's poster slot: hidden under the copy on the way in, and on the way out once the copy draws. */
export function HeroTarget({ id, children }: { id: string; children: ReactNode }) {
  const slot = use(Slot);
  const current = useFlight();
  const hidden =
    HERO && current?.id === id && (current.phase === 'opening' || (current.phase === 'closing' && current.shown));
  return (
    <View ref={slot} collapsable={false} style={hidden ? styles.hidden : undefined}>
      {children}
    </View>
  );
}

/** The copy in flight, drawn over everything. Mounted once at the root. */
export function HeroLayer() {
  const current = useFlight();
  if (!HERO || !current || current.phase === 'open') return null;
  return <Flying key={`${current.token}:${current.phase}`} flight={current} />;
}

function Flying({ flight: { token, id, from, to, phase } }: { flight: Flight }) {
  const back = phase === 'closing';
  const visible = useSharedValue(0);
  const started = useRef(false);

  // Moves once the copy has drawn, or after DRAW_WITHIN at the latest, so nothing moves blank.
  const start = () => {
    if (started.current) return;
    started.current = true;
    visible.value = 1;
    update(token, { shown: true });
    progress.value = withTiming(back ? 0 : 1, back ? CLOSE : OPEN, (done) => {
      if (done) runOnJS(land)(token, back);
    });
  };

  useEffect(() => {
    const timer = setTimeout(start, DRAW_WITHIN);
    return () => clearTimeout(timer);
  });

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
        <Art id={id} kind="poster" style={styles.poster} fade={false} placeholder={false} onDisplay={start} />
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
