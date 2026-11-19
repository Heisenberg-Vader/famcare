import { toDate } from '../lib/time.js';

/** Plain object from a Firestore doc: Timestamps -> Date, pending server times estimated. */
export function fromDoc(snap) {
  const data = snap.data({ serverTimestamps: 'estimate' });
  const out = { id: snap.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === 'function' ? toDate(v) : v;
  }
  out.pending = snap.metadata?.hasPendingWrites ?? false;
  return out;
}
