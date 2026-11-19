import { useState } from 'react';
import { atIST, toTimeString } from '../lib/time.js';

const FUTURE_TOLERANCE_MS = 60 * 1000;

/**
 * Time-of-day input for an entry on `dateKey` (IST). Defaults to `initialAt` or now.
 * resolve(now) -> { at } or { error } (entries cannot be in the future).
 */
export function useTimeField(dateKey, initialAt) {
  const [time, setTime] = useState(() => toTimeString(initialAt ?? new Date()));
  return {
    time,
    setTime,
    resolve(now = new Date()) {
      if (!/^\d{2}:\d{2}$/.test(time)) return { error: 'Enter a time' };
      const at = atIST(dateKey, time);
      if (at - now > FUTURE_TOLERANCE_MS) return { error: 'Time cannot be in the future' };
      return { at };
    },
  };
}
