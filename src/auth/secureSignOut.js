// Secure sign-out: never leave patient data on the device.
//   1. wait (max 8 s) for queued Firestore writes to reach the server;
//      if they do not, throw UnsyncedWritesError so the UI can ask before discarding them
//   2. terminate Firestore and delete its IndexedDB cache
//   3. sign out of Firebase Auth
// A localStorage flag marks a wipe in progress; if the wipe fails (e.g. another tab holds the
// database), completePendingWipe() finishes it the next time the app starts.
import { signOut as firebaseSignOut } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, forgetDb, getDbForWipe } from '../lib/firebase.js';
import { clearSessionState, isWipePending, setWipePending } from './deviceState.js';

export const PENDING_WRITES_TIMEOUT_MS = 8000;

export class UnsyncedWritesError extends Error {
  constructor(count) {
    super(
      count == null
        ? 'Some entries have not synced to the server yet.'
        : `${count} ${count === 1 ? 'entry has' : 'entries have'} not synced to the server yet.`,
    );
    this.name = 'UnsyncedWritesError';
    this.count = count;
  }
}

export class DataWipeError extends Error {
  constructor(cause) {
    super(
      'Signed out, but local data could not be fully cleared. Close other CarePal tabs; it is cleared automatically the next time the app opens.',
    );
    this.name = 'DataWipeError';
    this.cause = cause;
  }
}

/** Resolves true if `promise` settles successfully within `ms`, false otherwise. */
function settlesWithin(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([
    promise.then(
      () => true,
      () => false,
    ),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

/** Terminates Firestore and deletes its IndexedDB data. */
export async function wipeLocalData() {
  setWipePending(true);
  const db = getDbForWipe();
  await terminate(db);
  forgetDb();
  await clearIndexedDbPersistence(db);
  setWipePending(false);
}

/** Finishes a wipe that an earlier sign-out could not complete. Call before Firestore is used. */
export async function completePendingWipe() {
  if (!isWipePending()) return false;
  await wipeLocalData();
  return true;
}

/**
 * options:
 *   discardUnsynced  skip the pending-writes check (user confirmed discarding)
 *   timeoutMs        how long to wait for pending writes
 *   countPendingWrites  async () => number, used for the message when writes are unsynced
 * Throws UnsyncedWritesError (nothing changed) or DataWipeError (signed out, wipe incomplete).
 */
export async function secureSignOut({
  discardUnsynced = false,
  timeoutMs = PENDING_WRITES_TIMEOUT_MS,
  countPendingWrites,
} = {}) {
  const db = getDbForWipe();

  if (!discardUnsynced) {
    const synced = await settlesWithin(waitForPendingWrites(db), timeoutMs);
    if (!synced) {
      const count = countPendingWrites ? await countPendingWrites().catch(() => null) : null;
      throw new UnsyncedWritesError(count);
    }
  }

  let wipeError = null;
  try {
    await wipeLocalData();
  } catch (err) {
    wipeError = err;
  }
  clearSessionState();
  await firebaseSignOut(auth);
  if (wipeError) throw new DataWipeError(wipeError);
}
