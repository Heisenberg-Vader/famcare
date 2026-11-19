import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signIn as signInRequest, watchAuth } from '../data/auth.js';
import { countPendingEntryWrites } from '../data/entries.js';
import { userMessage } from '../data/errors.js';
import { openSession } from '../data/session.js';
import { getUserProfile } from '../data/users.js';
import { AuthContext } from './authContext.js';
import { clearSessionState, markActivity, readRoleHint, writeRoleHint } from './deviceState.js';
import {
  DataWipeError,
  UnsyncedWritesError,
  completePendingWipe,
  secureSignOut,
  wipeLocalData,
} from './secureSignOut.js';
import { SignOutDialog } from './SignOutDialog.jsx';

const INITIAL = { status: 'loading', user: null, role: null, profile: null, error: null };
const IDLE_RETRY_MS = 20000;

// A full reload drops every in-memory copy of patient data (React state, memory cache).
const reloadToLogin = () => window.location.replace('/login');

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL);
  // null | { reason: 'manual'|'idle', phase: 'checking'|'blocked'|'discarding'|'error', count, message }
  const [signOutState, setSignOutState] = useState(null);
  const profileRef = useRef(null);
  const signingOut = useRef(false);
  const hadUser = useRef(false);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    let latest = 0;

    (async () => {
      // Finish a wipe that a previous sign-out could not complete, before any data loads.
      await completePendingWipe().catch(() => {});
      if (cancelled) return;
      unsubscribe = watchAuth(async ({ user, role, offline, error }) => {
        const run = ++latest;
        if (!user) {
          if (hadUser.current && !signingOut.current) {
            // Signed out in another tab: wipe this tab's data too.
            await wipeLocalData().catch(() => {});
            clearSessionState();
            reloadToLogin();
            return;
          }
          setState({ ...INITIAL, status: 'signedOut' });
          return;
        }
        hadUser.current = true;
        const effectiveRole = role ?? (offline ? readRoleHint(user.uid) : null);
        if (!effectiveRole) {
          setState({ status: 'noRole', user, role: null, profile: null, error });
          return;
        }
        if (role) writeRoleHint(user.uid, role);
        try {
          openSession(effectiveRole);
        } catch {
          reloadToLogin(); // cache mode mismatch: start clean
          return;
        }
        const profile = await getUserProfile(user.uid).catch(() => null);
        if (run !== latest) return;
        profileRef.current = profile;
        setState({ status: 'signedIn', user, role: effectiveRole, profile, error: null });
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    await signInRequest(email, password);
    markActivity();
  }, []);

  /** Never rejects; progress and problems are shown in SignOutDialog. */
  const signOut = useCallback(async ({ reason = 'manual', discardUnsynced = false } = {}) => {
    if (signingOut.current) return;
    signingOut.current = true;
    setSignOutState({ reason, phase: discardUnsynced ? 'discarding' : 'checking' });
    try {
      await secureSignOut({
        discardUnsynced,
        countPendingWrites: () => countPendingEntryWrites(profileRef.current?.patientIds),
      });
      reloadToLogin();
    } catch (err) {
      signingOut.current = false;
      if (err instanceof UnsyncedWritesError) {
        setSignOutState({ reason, phase: 'blocked', count: err.count });
      } else if (err instanceof DataWipeError) {
        signingOut.current = true; // already signed out; wait for the user to acknowledge
        setSignOutState({ reason, phase: 'error', message: err.message, signedOut: true });
      } else {
        setSignOutState({ reason, phase: 'error', message: userMessage(err) });
      }
    }
  }, []);

  // Idle sign-out blocked by unsynced writes: keep retrying until they sync.
  useEffect(() => {
    if (signOutState?.reason !== 'idle' || signOutState.phase !== 'blocked') return undefined;
    const timer = setTimeout(() => signOut({ reason: 'idle' }), IDLE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [signOutState, signOut]);

  const dialogActions = useMemo(
    () => ({
      onDiscard: () => signOut({ reason: signOutState?.reason, discardUnsynced: true }),
      onRetry: () => signOut({ reason: signOutState?.reason }),
      onCancel: () => setSignOutState(null),
      onAcknowledge: reloadToLogin,
    }),
    [signOut, signOutState?.reason],
  );

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return (
    <AuthContext.Provider value={value}>
      {signOutState ? <SignOutDialog state={signOutState} {...dialogActions} /> : children}
    </AuthContext.Provider>
  );
}
