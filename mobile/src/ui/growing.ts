import { useEffect, useState } from 'react';

/**
 * How many of `total` items to mount now: `first` at once, then `step` more each frame, so a long list appears
 * over a few short frames instead of one long one. Mount the list under a `key` that changes with its contents
 * to start over.
 */
export function useGrowing(total: number, first = 3, step = 2): number {
  const [count, setCount] = useState(first);

  useEffect(() => {
    if (count >= total) return;
    const frame = requestAnimationFrame(() => setCount(count + step));

    return () => cancelAnimationFrame(frame);
  }, [count, total, step]);

  return Math.min(count, total);
}
