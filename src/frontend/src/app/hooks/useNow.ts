'use client';

import { useState, useEffect } from 'react';

/**
 * Current epoch ms, re-rendering the consumer every `intervalMs`.
 * Drives relative timestamps ("7s ago") so they tick between data updates
 * instead of freezing until the next re-render.
 */
export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
