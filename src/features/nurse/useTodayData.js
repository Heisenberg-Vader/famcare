import { watchNurseEntries } from '../../data/entries.js';
import { watchMedications } from '../../data/medications.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { todayKey } from '../../lib/time.js';

/** Live medications and today+yesterday entries for one patient (nurse scope). */
export function useTodayData(patientId, now) {
  const today = todayKey(now);
  const meds = useSubscription(
    (ok, err) => watchMedications(patientId, ok, err),
    patientId ?? null,
  );
  // Re-subscribe when the IST date changes so the window moves at midnight.
  const entries = useSubscription(
    (ok, err) => watchNurseEntries(patientId, ok, err, new Date()),
    patientId ? `${patientId}|${today}` : null,
  );
  const todayEntries = (entries.data ?? []).filter((e) => e.dateKey === today);
  return {
    today,
    medications: meds.data ?? [],
    todayEntries,
    loading: meds.loading || entries.loading,
    error: meds.error ?? entries.error,
  };
}
