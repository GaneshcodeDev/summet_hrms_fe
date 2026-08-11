"use client";

import { useEffect, useState } from "react";

/**
 * Reads the wall clock outside of render (React's purity rules forbid
 * calling `Date.now()` during render) so lockout/expiry checks stay live.
 * Returns null until the first effect tick to avoid a hydration mismatch.
 */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Deliberate one-time sync of the wall clock into state on mount, then a
    // ticking subscription — not a derived-state update loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
