// Per-day markers for the family calendar: a day is flagged when any vital was out of range
// or any scheduled dose was missed, refused, held or not recorded.
import { getRanges, isOutOfRange } from './ranges.js';
import { expectedDoses, resolveDoses } from './schedule.js';

/** Map dateKey -> { outOfRange, doseIssue } for flagged days only. */
export function dayFlags({ entries = [], medications = [], patient, dateKeys, now = new Date() }) {
  const ranges = getRanges(patient);
  const byDay = new Map(dateKeys.map((k) => [k, []]));
  for (const e of entries) byDay.get(e.dateKey)?.push(e);

  const flags = new Map();
  for (const dateKey of dateKeys) {
    const dayEntries = byDay.get(dateKey);
    const outOfRange = dayEntries.some((e) => isOutOfRange(e, ranges));
    const doses = resolveDoses(expectedDoses(medications, dateKey), dayEntries, now);
    const doseIssue = doses.some((d) => !['given', 'pending'].includes(d.status));
    if (outOfRange || doseIssue) flags.set(dateKey, { outOfRange, doseIssue });
  }
  return flags;
}

/** First and last date key of the month `monthKey` ('YYYY-MM'), capped at `maxKey`. */
export function monthBounds(monthKey, maxKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const start = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  return { start, end: maxKey && end > maxKey ? maxKey : end };
}
