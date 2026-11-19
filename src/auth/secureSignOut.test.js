import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
const fakeDb = { name: 'db' };

vi.mock('firebase/firestore', () => ({
  waitForPendingWrites: vi.fn(),
  terminate: vi.fn(async () => calls.push('terminate')),
  clearIndexedDbPersistence: vi.fn(async () => calls.push('clearIndexedDbPersistence')),
}));
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(async () => calls.push('signOut')),
}));
vi.mock('../lib/firebase.js', () => ({
  auth: { name: 'auth' },
  getDbForWipe: vi.fn(() => fakeDb),
  forgetDb: vi.fn(() => calls.push('forgetDb')),
}));

const firestore = await import('firebase/firestore');
const firebaseAuth = await import('firebase/auth');
const {
  DataWipeError,
  PENDING_WRITES_TIMEOUT_MS,
  UnsyncedWritesError,
  completePendingWipe,
  secureSignOut,
} = await import('./secureSignOut.js');
const { isWipePending, markActivity, readLastActivity, setWipePending } =
  await import('./deviceState.js');

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('secureSignOut', () => {
  it('raises UnsyncedWritesError when waitForPendingWrites does not resolve', async () => {
    vi.useFakeTimers();
    firestore.waitForPendingWrites.mockReturnValue(new Promise(() => {}));
    const countPendingWrites = vi.fn().mockResolvedValue(3);

    const result = secureSignOut({ countPendingWrites });
    const assertion = expect(result).rejects.toMatchObject({
      name: 'UnsyncedWritesError',
      count: 3,
    });
    await vi.advanceTimersByTimeAsync(PENDING_WRITES_TIMEOUT_MS);
    await assertion;
    await expect(result).rejects.toBeInstanceOf(UnsyncedWritesError);

    expect(firestore.waitForPendingWrites).toHaveBeenCalledWith(fakeDb);
    expect(firestore.terminate).not.toHaveBeenCalled();
    expect(firestore.clearIndexedDbPersistence).not.toHaveBeenCalled();
    expect(firebaseAuth.signOut).not.toHaveBeenCalled();
  });

  it('does not give up before the 8 second timeout', async () => {
    vi.useFakeTimers();
    let resolveWrites;
    firestore.waitForPendingWrites.mockReturnValue(new Promise((r) => (resolveWrites = r)));
    const result = secureSignOut();
    await vi.advanceTimersByTimeAsync(PENDING_WRITES_TIMEOUT_MS - 100);
    resolveWrites();
    await expect(result).resolves.toBeUndefined();
    expect(calls).toEqual(['terminate', 'forgetDb', 'clearIndexedDbPersistence', 'signOut']);
  });

  it('reports an unknown count when counting fails', async () => {
    vi.useFakeTimers();
    firestore.waitForPendingWrites.mockReturnValue(new Promise(() => {}));
    const result = secureSignOut({ countPendingWrites: () => Promise.reject(new Error('x')) });
    const assertion = expect(result).rejects.toMatchObject({ count: null });
    await vi.advanceTimersByTimeAsync(PENDING_WRITES_TIMEOUT_MS);
    await assertion;
  });

  it('when synced: terminates, clears IndexedDB, then signs out and clears session flags', async () => {
    firestore.waitForPendingWrites.mockResolvedValue(undefined);
    markActivity(123);
    await secureSignOut();
    expect(calls).toEqual(['terminate', 'forgetDb', 'clearIndexedDbPersistence', 'signOut']);
    expect(readLastActivity()).toBeNull();
    expect(isWipePending()).toBe(false);
  });

  it('discarding skips the pending-writes wait', async () => {
    await secureSignOut({ discardUnsynced: true });
    expect(firestore.waitForPendingWrites).not.toHaveBeenCalled();
    expect(calls).toEqual(['terminate', 'forgetDb', 'clearIndexedDbPersistence', 'signOut']);
  });

  it('still signs out when the wipe fails and leaves the wipe pending for next start', async () => {
    firestore.waitForPendingWrites.mockResolvedValue(undefined);
    firestore.clearIndexedDbPersistence.mockRejectedValueOnce(new Error('in use by another tab'));
    await expect(secureSignOut()).rejects.toBeInstanceOf(DataWipeError);
    expect(firebaseAuth.signOut).toHaveBeenCalled();
    expect(isWipePending()).toBe(true);

    await expect(completePendingWipe()).resolves.toBe(true);
    expect(isWipePending()).toBe(false);
  });

  it('completePendingWipe does nothing without a pending wipe', async () => {
    setWipePending(false);
    await expect(completePendingWipe()).resolves.toBe(false);
    expect(firestore.terminate).not.toHaveBeenCalled();
  });
});
