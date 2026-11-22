import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAnimatedScrollHandler, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { motion } from '@/theme';

const TRAVEL = 72;

type Chrome = {
  hidden: SharedValue<number>;
  docked: number;
  setDocked: (height: number) => void;
  bottom: number;
};

const Context = createContext<Chrome | null>(null);

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

type PullHooks = {
  offset: SharedValue<number>;
  fromBounce: (y: number) => void;
  endBounce: () => void;
};

export function useChromeScroll(pull?: PullHooks) {
  const { hidden } = useChrome();

  useEffect(() => {
    hidden.set(withSpring(0, motion.settle));
  }, [hidden]);

  return useAnimatedScrollHandler<{ last: number }>({
    onBeginDrag: (event, context) => {
      context.last = event.contentOffset.y;
    },
    onScroll: (event, context) => {
      const y = event.contentOffset.y;

      if (pull) {
        pull.offset.set(y);
        pull.fromBounce(y);
      }

      const last = context.last ?? y;
      context.last = y;

      if (y <= 0) {
        hidden.set(0);

        return;
      }

      const maxY = event.contentSize.height - event.layoutMeasurement.height;

      if (y >= maxY) return;
      hidden.set(Math.min(1, Math.max(0, hidden.get() + (y - last) / TRAVEL)));
    },
    onEndDrag: (event) => {
      pull?.endBounce();

      if (event.contentOffset.y <= 0) return;
      hidden.set(withSpring(hidden.get() > 0.5 ? 1 : 0, motion.settle));
    },
    onMomentumEnd: () => {
      hidden.set(withSpring(hidden.get() > 0.5 ? 1 : 0, motion.settle));
    },
  });
}
