import { createContext, useContext } from 'react';

/**
 * status: 'loading' | 'signedOut' | 'signedIn' | 'noRole'
 * value: { status, user, role, profile, error, signIn(email, password), signOut() }
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
