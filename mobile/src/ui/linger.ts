import { useEffect, useState } from 'react';

/** Whether `on` has held for `ms`, for work worth doing only once a person stays: true from then on. */
export function useLingered(on: boolean, ms: number): boolean {
  const [lingered, setLingered] = useState(false);

  useEffect(() => {
    if (!on || lingered) return;
    const timer = setTimeout(() => setLingered(true), ms);

    return () => clearTimeout(timer);
  }, [on, lingered, ms]);

  return lingered;
}
