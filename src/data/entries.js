import { Timestamp, collection, getDocsFromCache, query, where } from 'firebase/firestore';
import { getDb } from '../lib/firebase.js';
import { nurseWindow } from '../lib/scope.js';

const entriesOf = (patientId) => collection(getDb(), 'patients', patientId, 'entries');

/**
 * Nurse-scoped query: today and yesterday only. The `at` bound is what the Firestore rules
 * check, so the query is provably inside the allowed window.
 */
export function nurseEntriesQuery(patientId, now = new Date()) {
  const { dateKeys, since } = nurseWindow(now);
  return query(
    entriesOf(patientId),
    where('dateKey', 'in', dateKeys),
    where('at', '>=', Timestamp.fromDate(since)),
  );
}

/** Entries saved on this device that have not reached the server (from the local cache). */
export async function countPendingEntryWrites(patientIds, now = new Date()) {
  let count = 0;
  for (const patientId of patientIds ?? []) {
    const snap = await getDocsFromCache(nurseEntriesQuery(patientId, now));
    count += snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
  }
  return count;
}
