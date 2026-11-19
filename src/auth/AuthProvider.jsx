import { useCallback, useEffect, useMemo, useState } from 'react';
import { signIn as signInRequest, signOut as signOutRequest, watchAuth } from '../data/auth.js';
import { getUserProfile } from '../data/users.js';
import { AuthContext } from './authContext.js';

const INITIAL = { status: 'loading', user: null, role: null, profile: null, error: null };

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let latest = 0;
    const unsubscribe = watchAuth(async ({ user, role, offline, error }) => {
      const run = ++latest;
      if (!user) {
        setState({ ...INITIAL, status: 'signedOut' });
        return;
      }
      // The profile only adds a display name (and an offline role fallback); never block on it.
      const profile = await getUserProfile(user.uid).catch(() => null);
      if (run !== latest) return;
      // Offline with an expired token: fall back to the cached profile's role so a nurse can
      // keep logging. The server still checks the real claim when writes sync.
      const effectiveRole = role ?? (offline ? (profile?.role ?? null) : null);
      setState({
        status: effectiveRole ? 'signedIn' : 'noRole',
        user,
        role: effectiveRole,
        profile,
        error,
      });
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback((email, password) => signInRequest(email, password), []);
  const signOut = useCallback(() => signOutRequest(), []);

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
