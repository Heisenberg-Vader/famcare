import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDocs,
  getDocsFromCache,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { validatePayload } from '../lib/entries.js';
import { getDb } from '../lib/firebase.js';
import { nurseWindow } from '../lib/scope.js';
import { toDate, toDateKey } from '../lib/time.js';
import { UserFacingError, toUserError } from './errors.js';
import { fromDoc } from './snapshot.js';

const entriesOf = (patientId) => collection(getDb(), 'patients', patientId, 'entries');

const byAt = (a, b) => a.at - b.at;

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

/** Live entries for today and yesterday, sorted by `at`. Includes unsynced local writes. */
export function watchNurseEntries(patientId, onData, onError, now = new Date()) {
  return onSnapshot(
    nurseEntriesQuery(patientId, now),
    { includeMetadataChanges: true },
    (snap) => onData(snap.docs.map(fromDoc).sort(byAt), { fromCache: snap.metadata.fromCache }),
    (err) => onError?.(toUserError(err, 'Could not load entries.')),
  );
}

/** Live entries of one IST day, sorted by `at` (family "today" view). */
export function watchDayEntries(patientId, dateKey, onData, onError) {
  const q = query(entriesOf(patientId), where('dateKey', '==', dateKey), orderBy('at'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(fromDoc)),
    (err) => onError?.(toUserError(err, 'Could not load this day.')),
  );
}

/** One-off read of a past day. */
export async function getDayEntries(patientId, dateKey) {
  try {
    const q = query(entriesOf(patientId), where('dateKey', '==', dateKey), orderBy('at'));
    return (await getDocs(q)).docs.map(fromDoc);
  } catch (err) {
    throw toUserError(err, 'Could not load this day.');
  }
}

/** One-off read of an inclusive range of IST days, sorted by `at`. */
export async function getEntriesBetween(patientId, startKey, endKey) {
  try {
    const q = query(
      entriesOf(patientId),
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', endKey),
      orderBy('dateKey'),
      orderBy('at'),
    );
    return (await getDocs(q)).docs.map(fromDoc);
  } catch (err) {
    throw toUserError(err, 'Could not load entries for these dates.');
  }
}

/** Vitals entries since `since` (a Date), sorted by `at`. Uses the (type, at) index. */
export async function getVitalsSince(patientId, since) {
  try {
    const q = query(
      entriesOf(patientId),
      where('type', '==', 'vitals'),
      where('at', '>=', Timestamp.fromDate(since)),
      orderBy('at'),
    );
    return (await getDocs(q)).docs.map(fromDoc);
  } catch (err) {
    throw toUserError(err, 'Could not load vitals.');
  }
}

/**
 * Entries created or edited after `since` (a Date), any day. Lets the report cache check
 * for changes with a handful of reads instead of reloading the whole period.
 */
export async function getEntriesChangedSince(patientId, since) {
  try {
    const q = query(entriesOf(patientId), where('updatedAt', '>', Timestamp.fromDate(since)));
    return (await getDocs(q)).docs.map(fromDoc);
  } catch (err) {
    throw toUserError(err, 'Could not check for new entries.');
  }
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

function checkPayload(type, payload) {
  const result = validatePayload(type, payload);
  if (!result.ok) {
    throw new UserFacingError(Object.values(result.errors)[0] ?? 'Check the form.');
  }
  return result.value;
}

/**
 * Creates an entry without waiting for the server (writes never resolve while offline).
 * Validation errors throw synchronously; server rejections go to onError.
 * Returns the new entry id.
 */
export function createEntry({ patientId, type, payload, at, nurse, onError }) {
  const value = checkPayload(type, payload);
  const when = toDate(at) ?? new Date();
  const ref = doc(entriesOf(patientId));
  setDoc(ref, {
    type,
    ...value,
    at: Timestamp.fromDate(when),
    dateKey: toDateKey(when),
    nurseId: nurse.uid,
    nurseName: nurse.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch((err) => onError?.(toUserError(err, 'Could not save the entry.')));
  return ref.id;
}

/**
 * Edits an entry (own entries, within 12 h; enforced by the rules). Fields removed from the
 * payload (e.g. a dose reason after switching to 'given') are deleted.
 */
export function updateEntry({ patientId, entry, payload, at, onError }) {
  const value = checkPayload(entry.type, payload);
  const when = toDate(at) ?? entry.at;
  const changes = { ...value, at: Timestamp.fromDate(when), dateKey: toDateKey(when) };
  for (const key of [
    'reason',
    'notes',
    'sugarContext',
    'systolic',
    'diastolic',
    'pulse',
    'spo2',
    'sugar',
    'tempF',
    'weightKg',
  ]) {
    if (key in entry && !(key in value)) changes[key] = deleteField();
  }
  updateDoc(doc(entriesOf(patientId), entry.id), {
    ...changes,
    updatedAt: serverTimestamp(),
  }).catch((err) => onError?.(toUserError(err, 'Could not save the change.')));
}
