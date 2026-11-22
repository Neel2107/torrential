import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { motion } from '@/theme';

/** How far a finger scrolls, in points, to hide the bars all the way. */
const TRAVEL = 72;

type Chrome = {
  hidden: SharedValue<number>;
  /** How much of the bottom the cast bar covers, in points. */
  docked: number;
  setDocked: (height: number) => void;
  /** The room a feed leaves at its bottom, and the floating button keeps above: the bars and the cast bar. */
  bottom: number;
};

const Context = createContext<Chrome | null>(null);

/**
 * The bars around a feed: 0 is fully shown, 1 fully hidden. `bar` is the room the tab bar takes at
 * the bottom, which each feed leaves. Scrolling moves them with the finger,
 * as X does, and they settle open or shut when the finger lets go.
 */
export function ChromeProvider({ bar, children }: { bar: number; children: ReactNode }) {
  const hidden = useSharedValue(0);
  const [docked, setDocked] = useState(0);
  const value = useMemo(() => ({ hidden, docked, setDocked, bottom: bar + docked }), [hidden, docked, bar]);
  return <Context value={value}>{children}</Context>;
}

export function useChrome(): Chrome {
  const chrome = use(Context);
  if (!chrome) throw new Error('useChrome outside ChromeProvider');
  return chrome;
}

/** What a feed that pulls to refresh hears from its scroll: where it is, and its bounce past the top. */
type PullHooks = {
  offset: SharedValue<number>;
  fromBounce: (y: number) => void;
  endBounce: () => void;
};

/** A scroll handler that drives the bars. Each screen that owns a feed passes it to its list. */
export function useChromeScroll(pull?: PullHooks) {
  const { hidden } = useChrome();

  useEffect(() => {
    hidden.value = withSpring(0, motion.settle);
  }, [hidden]);

  return useAnimatedScrollHandler<{ last: number }>({
    onBeginDrag: (event, context) => {
      context.last = event.contentOffset.y;
    },
    onScroll: (event, context) => {
      const y = event.contentOffset.y;
      if (pull) {
        pull.offset.value = y;
        pull.fromBounce(y);
      }
      const last = context.last ?? y;
      context.last = y;
      if (y <= 0) {
        hidden.value = 0;
        return;
      }
      const maxY = event.contentSize.height - event.layoutMeasurement.height;
      if (y >= maxY) return;
      hidden.value = Math.min(1, Math.max(0, hidden.value + (y - last) / TRAVEL));
    },
    onEndDrag: (event) => {
      pull?.endBounce();
      if (event.contentOffset.y <= 0) return;
      hidden.value = withSpring(hidden.value > 0.5 ? 1 : 0, motion.settle);
    },
    onMomentumEnd: () => {
      hidden.value = withSpring(hidden.value > 0.5 ? 1 : 0, motion.settle);
    },
  });
}
