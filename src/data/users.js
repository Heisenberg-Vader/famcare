import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.js';
import { toUserError } from './errors.js';

/** users/{uid}; served from the offline cache when there is no network. */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    throw toUserError(err, 'Could not load your profile.');
  }
}
