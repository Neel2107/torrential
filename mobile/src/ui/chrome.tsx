import { createContext, use, useEffect, useMemo, type ReactNode } from 'react';
import {
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { motion } from '@/theme';

/** How far a finger scrolls, in points, to hide the bars all the way. */
const TRAVEL = 72;

type Chrome = { hidden: SharedValue<number> };

const Context = createContext<Chrome | null>(null);

/**
 * The bars around a feed: 0 is fully shown, 1 fully hidden. Scrolling moves them with the finger,
 * as X does, and they settle open or shut when the finger lets go.
 */
export function ChromeProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const value = useMemo(() => ({ hidden }), [hidden]);
  return <Context value={value}>{children}</Context>;
}

export function useChrome(): Chrome {
  const chrome = use(Context);
  if (!chrome) throw new Error('useChrome outside ChromeProvider');
  return chrome;
}

/** A scroll handler that drives the bars. Each screen that owns a feed passes it to its list. */
export function useChromeScroll() {
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
      if (event.contentOffset.y <= 0) return;
      hidden.value = withSpring(hidden.value > 0.5 ? 1 : 0, motion.settle);
    },
    onMomentumEnd: () => {
      hidden.value = withSpring(hidden.value > 0.5 ? 1 : 0, motion.settle);
    },
  });
}
