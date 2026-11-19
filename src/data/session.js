import { initDb } from '../lib/firebase.js';

/** Creates the Firestore instance with the cache that matches the role. */
export function openSession(role) {
  initDb(role);
}
