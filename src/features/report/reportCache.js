// In-memory cache of generated reports, so pressing "Download" again gives back the exact
// same PDF without re-reading ~800 entries or rebuilding it. Memory only: never written to
// localStorage or IndexedDB, and gone on reload (secure sign-out always reloads the page).

// Entries are compared by server time; allow for a device clock that runs ahead.
export const CLOCK_SKEW_MS = 10 * 60 * 1000;

const cache = new Map(); // patientId -> { key, startKey, endKey, checkFrom, blob, fileName }

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  }
  return value;
}

const PATIENT_FIELDS = [
  'fullName',
  'dob',
  'gender',
  'city',
  'conditions',
  'primaryDoctor',
  'nurses',
  'rangeOverrides',
];

/**
 * Identifies everything the report depends on apart from the entries themselves:
 * the period, the patient details and ranges, and the prescription list.
 */
export function reportKey({ period, patient, medications }) {
  const p = Object.fromEntries(PATIENT_FIELDS.map((k) => [k, patient?.[k] ?? null]));
  const meds = [...(medications ?? [])]
    .map((m) => {
      // `pending` is snapshot metadata, not part of the prescription.
      const copy = { ...m };
      delete copy.pending;
      return copy;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return JSON.stringify(stable({ end: period.endKey, start: period.fetchStartKey, p, meds }));
}

export function getCachedReport(patientId, key) {
  const hit = cache.get(patientId);
  return hit && hit.key === key ? hit : null;
}

/** readStartedAt: device time just before the entries were read. */
export function putCachedReport(patientId, { key, period, readStartedAt, blob, fileName }) {
  cache.set(patientId, {
    key,
    startKey: period.fetchStartKey,
    endKey: period.endKey,
    checkFrom: new Date(readStartedAt.getTime() - CLOCK_SKEW_MS),
    blob,
    fileName,
  });
}

export function dropCachedReport(patientId) {
  cache.delete(patientId);
}

export function clearReportCache() {
  cache.clear();
}

/** True if any of `changed` (entries updated since the report was read) falls in its range. */
export function affectsReport(cached, changed) {
  return (changed ?? []).some((e) => e.dateKey >= cached.startKey && e.dateKey <= cached.endKey);
}
