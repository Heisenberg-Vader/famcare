import { useMemo } from 'react';
import { getEntriesBetween } from '../../data/entries.js';
import { useAsync } from '../../hooks/useAsync.js';
import { dayFlags, monthBounds } from '../../lib/dayFlags.js';
import { addDaysToKey, dateKeysBetween } from '../../lib/time.js';

// Months that ended before yesterday cannot change any more (edits are allowed for 12 h),
// so they are kept in memory for the session. Memory only: cleared by the sign-out reload.
const finishedMonths = new Map();

/**
 * Calendar flags for the visible month. Today's flags come from the live entries so a new
 * out-of-range reading shows a dot immediately.
 */
export function useMonthFlags({ patient, medications, monthKey, today, todayEntries, now }) {
  const { start, end } = monthBounds(monthKey, today);
  const cacheKey = `${patient?.id}|${monthKey}`;
  const finished = end < addDaysToKey(today, -1);
  const key = patient && start <= today ? `${cacheKey}|${finished ? 'final' : today}` : null;

  const month = useAsync(async () => {
    if (finished && finishedMonths.has(cacheKey)) return finishedMonths.get(cacheKey);
    const entries = await getEntriesBetween(patient.id, start, end);
    if (finished) finishedMonths.set(cacheKey, entries);
    return entries;
  }, key);

  const flags = useMemo(() => {
    if (!month.data || start > today) return new Map();
    const past = month.data.filter((e) => e.dateKey !== today);
    const entries = end >= today ? [...past, ...(todayEntries ?? [])] : past;
    return dayFlags({ entries, medications, patient, dateKeys: dateKeysBetween(start, end), now });
  }, [month.data, todayEntries, medications, patient, start, end, today, now]);

  return { flags, loading: month.loading, error: month.error };
}
