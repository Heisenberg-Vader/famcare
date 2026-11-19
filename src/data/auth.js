import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase.js';
import { UserFacingError, isNetworkError, toUserError } from './errors.js';

export const ROLES = Object.freeze(['nurse', 'family']);

const validRole = (role) => (ROLES.includes(role) ? role : null);

/**
 * Role from the ID token's custom claim. If the cached token has no role (claims set after
 * the token was issued), forces one refresh. Returns { role, offline }; offline is true when
 * the token could not be refreshed for lack of network.
 */
async function readRoleClaim(user) {
  try {
    let result = await user.getIdTokenResult();
    if (!result.claims.role) result = await user.getIdTokenResult(true);
    return { role: validRole(result.claims.role), offline: false };
  } catch (err) {
    if (isNetworkError(err)) return { role: null, offline: true };
    throw toUserError(err, 'Could not verify your account.');
  }
}

/**
 * Calls back with { user, role, offline, error } on every sign-in state change.
 * Returns an unsubscribe function.
 */
export function watchAuth(callback) {
  if (!isFirebaseConfigured) {
    callback({ user: null, role: null, offline: false, error: null });
    return () => {};
  }
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      callback({ user: null, role: null, offline: false, error: null });
      return;
    }
    const user = { uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName };
    try {
      const { role, offline } = await readRoleClaim(fbUser);
      callback({ user, role, offline, error: null });
    } catch (error) {
      callback({ user, role: null, offline: false, error });
    }
  });
}

export async function signIn(email, password) {
  if (!isFirebaseConfigured) {
    throw new UserFacingError('The app is not configured: Firebase keys are missing.');
  }
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (err) {
    throw toUserError(err, 'Could not sign in. Please try again.');
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    throw toUserError(err, 'Could not sign out. Please try again.');
  }
}
