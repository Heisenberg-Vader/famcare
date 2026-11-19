// Turns Firebase errors into messages a nurse or family member can act on.
const MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/user-disabled': 'This account has been disabled. Contact your care coordinator.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'No internet connection. Check your network and try again.',
  'auth/invalid-api-key': 'The app is not configured: Firebase keys are missing.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled for this project.',
  'permission-denied': 'You do not have access to this record.',
  unauthenticated: 'Your session has ended. Please sign in again.',
  unavailable: 'You appear to be offline. Changes will sync when you reconnect.',
  'not-found': 'That record no longer exists.',
  'failed-precondition':
    'This view needs a database index that is still building. Try again shortly.',
  'resource-exhausted': 'The daily usage limit was reached. Try again later.',
};

export const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

export class UserFacingError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'UserFacingError';
    this.cause = cause;
    this.code = cause?.code;
  }
}

export function userMessage(err, fallback = DEFAULT_MESSAGE) {
  if (err instanceof UserFacingError) return err.message;
  const code = typeof err?.code === 'string' ? err.code.replace(/^firestore\//, '') : '';
  return MESSAGES[code] ?? fallback;
}

/** Wraps any error so callers can show `error.message` directly. */
export function toUserError(err, fallback) {
  if (err instanceof UserFacingError) return err;
  return new UserFacingError(userMessage(err, fallback), err);
}

export function isNetworkError(err) {
  const code = err?.code ?? err?.cause?.code;
  return code === 'auth/network-request-failed' || code === 'unavailable';
}
