import { useAuth } from './authContext.js';
import { IDLE_TIMEOUT_MS, useIdleTimeout } from './useIdleTimeout.js';

/** Mounted on nurse routes: 30 minutes without interaction runs the secure sign-out. */
export function IdleSignOut({ timeoutMs = IDLE_TIMEOUT_MS }) {
  const { signOut } = useAuth();
  useIdleTimeout(() => signOut({ reason: 'idle' }), timeoutMs);
  return null;
}
