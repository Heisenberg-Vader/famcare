import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { toUserError } from './errors.js';
import { fromDoc } from './snapshot.js';

const FIELD_BY_ROLE = { nurse: 'nurseIds', family: 'familyIds' };

/**
 * Live list of the patients assigned to `uid`. The array-contains filter is required:
 * rules are not filters, an unfiltered query is rejected.
 */
export function watchMyPatients(uid, role, onData, onError) {
  const field = FIELD_BY_ROLE[role];
  if (!field) throw new Error(`Unknown role ${role}`);
  const q = query(collection(getDb(), 'patients'), where(field, 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map(fromDoc).sort((a, b) => String(a.fullName).localeCompare(b.fullName))),
    (err) => onError?.(toUserError(err, 'Could not load patients.')),
  );
}

export function watchPatient(patientId, onData, onError) {
  return onSnapshot(
    doc(getDb(), 'patients', patientId),
    (snap) => onData(snap.exists() ? fromDoc(snap) : null),
    (err) => onError?.(toUserError(err, 'Could not load this patient.')),
  );
}
