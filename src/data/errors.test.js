import { describe, expect, it } from 'vitest';
import { UserFacingError, isNetworkError, toUserError, userMessage } from './errors.js';

describe('error messages', () => {
  it('maps auth and Firestore codes', () => {
    expect(userMessage({ code: 'auth/invalid-credential' })).toBe(
      'Email or password is incorrect.',
    );
    expect(userMessage({ code: 'permission-denied' })).toBe(
      'You do not have access to this record.',
    );
    expect(userMessage({ code: 'firestore/unavailable' })).toMatch(/offline/);
  });

  it('falls back for unknown errors and keeps user-facing ones', () => {
    expect(userMessage(new Error('boom'), 'Could not save.')).toBe('Could not save.');
    const wrapped = toUserError({ code: 'auth/too-many-requests' });
    expect(wrapped).toBeInstanceOf(UserFacingError);
    expect(wrapped.code).toBe('auth/too-many-requests');
    expect(toUserError(wrapped)).toBe(wrapped);
  });

  it('detects network errors, including wrapped ones', () => {
    expect(isNetworkError({ code: 'auth/network-request-failed' })).toBe(true);
    expect(isNetworkError(toUserError({ code: 'unavailable' }))).toBe(true);
    expect(isNetworkError({ code: 'permission-denied' })).toBe(false);
  });
});
