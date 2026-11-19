import { useEffect, useRef } from 'react';
import { markActivity, readLastActivity } from './deviceState.js';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];
const STORE_THROTTLE_MS = 5000;
const CHECK_EVERY_MS = 15000;

/**
 * Calls onIdle once after `timeoutMs` without user interaction. Activity is shared across
 * tabs and reloads through localStorage, so reopening the app after a long gap also counts
 * as idle. Uses wall-clock time, so a phone that slept through the timeout fires on wake.
 */
export function useIdleTimeout(onIdle, timeoutMs = IDLE_TIMEOUT_MS) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  });

  useEffect(() => {
    let fired = false;
    let lastLocal = Date.now();
    let lastStored = 0;

    const lastActivity = () => Math.max(lastLocal, readLastActivity() ?? 0);
    const fire = () => {
      if (fired) return;
      fired = true;
      onIdleRef.current();
    };
    const check = () => {
      if (Date.now() - lastActivity() >= timeoutMs) fire();
    };

    const stored = readLastActivity();
    if (stored != null && Date.now() - stored >= timeoutMs) {
      fire();
      return undefined;
    }
    markActivity(lastLocal);

    const onActivity = () => {
      if (fired) return;
      lastLocal = Date.now();
      if (lastLocal - lastStored > STORE_THROTTLE_MS) {
        markActivity(lastLocal);
        lastStored = lastLocal;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(check, CHECK_EVERY_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [timeoutMs]);
}
