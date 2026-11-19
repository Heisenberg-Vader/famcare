import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { toUserError } from './errors.js';
import { fromDoc } from './snapshot.js';

/** Live prescription list of a patient (read-only on the client). */
export function watchMedications(patientId, onData, onError) {
  return onSnapshot(
    collection(getDb(), 'patients', patientId, 'medications'),
    (snap) => onData(snap.docs.map(fromDoc)),
    (err) => onError?.(toUserError(err, 'Could not load medicines.')),
  );
}
