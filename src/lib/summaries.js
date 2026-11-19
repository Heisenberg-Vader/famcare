// Pure summary functions shared by the weekly card, the PDF report and alerts.
// Inputs are plain entry objects ({ type, dateKey, at, ...payload }).
import { addDaysToKey, lastNDays } from './time.js';
import { expectedDoses, resolveDoses } from './schedule.js';

export const MAIN_MEALS = Object.freeze(['breakfast', 'lunch', 'dinner']);
export const MEAL_COMPLETE_PORTION = 0.75;
export const MOOD_FLAT_THRESHOLD = 0.25;

const round1 = (n) => Math.round(n * 10) / 10;
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);

function inDays(entries, type, dateKeys) {
  const keys = new Set(dateKeys);
  return (entries ?? []).filter((e) => e?.type === type && keys.has(e.dateKey));
}

/**
 * Adherence from resolved doses (see schedule.resolveDoses).
 * Pending doses (not yet due) are excluded from `expected`.
 */
export function adherence(resolvedDoses) {
  const counts = { given: 0, missed: 0, refused: 0, held: 0, notRecorded: 0, pending: 0 };
  for (const d of resolvedDoses ?? []) {
    if (d.status === 'not_recorded') counts.notRecorded += 1;
    else if (d.status in counts) counts[d.status] += 1;
  }
  const expected = (resolvedDoses?.length ?? 0) - counts.pending;
  return { ...counts, expected, percent: pct(counts.given, expected) };
}

/** Adherence for each medicine, sorted by name. */
export function adherenceByMedication(resolvedDoses) {
  const groups = new Map();
  for (const d of resolvedDoses ?? []) {
    if (!groups.has(d.medicationId)) groups.set(d.medicationId, []);
    groups.get(d.medicationId).push(d);
  }
  return [...groups.values()]
    .map((doses) => ({
      medicationId: doses[0].medicationId,
      medicationName: doses[0].medicationName,
      strength: doses[0].strength,
      ...adherence(doses),
    }))
    .sort((a, b) => String(a.medicationName).localeCompare(b.medicationName));
}

/** Main meals eaten at portion >= 0.75 over 3 expected main meals per day. */
export function mealsCompleted(entries, dateKeys) {
  const best = new Map();
  for (const e of inDays(entries, 'meal', dateKeys)) {
    if (!MAIN_MEALS.includes(e.slot)) continue;
    const key = `${e.dateKey}|${e.slot}`;
    best.set(key, Math.max(best.get(key) ?? 0, Number(e.portion) || 0));
  }
  const completed = [...best.values()].filter((p) => p >= MEAL_COMPLETE_PORTION).length;
  const expected = dateKeys.length * MAIN_MEALS.length;
  return { completed, expected, percent: pct(completed, expected) };
}

export function activityMinutes(entries, dateKeys) {
  const byDay = new Map(dateKeys.map((k) => [k, 0]));
  for (const e of inDays(entries, 'activity', dateKeys)) {
    byDay.set(e.dateKey, byDay.get(e.dateKey) + (Number(e.durationMin) || 0));
  }
  const perDay = dateKeys.map((dateKey) => ({ dateKey, minutes: byDay.get(dateKey) }));
  const total = perDay.reduce((sum, d) => sum + d.minutes, 0);
  return { total, perDay, averagePerDay: dateKeys.length ? round1(total / dateKeys.length) : 0 };
}

/** 'up' | 'down' | 'flat' comparing two averages; null when either is missing. */
export function trendDirection(current, previous, threshold = MOOD_FLAT_THRESHOLD) {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < threshold) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

/**
 * Daily average mood score (null on days without a mood entry), the period average,
 * and a direction comparing the second half of the period with the first half.
 */
export function moodTrend(entries, dateKeys) {
  const scores = new Map(dateKeys.map((k) => [k, []]));
  for (const e of inDays(entries, 'mood', dateKeys)) {
    const s = Number(e.score);
    if (Number.isFinite(s)) scores.get(e.dateKey).push(s);
  }
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const daily = dateKeys.map((dateKey) => {
    const a = avg(scores.get(dateKey));
    return { dateKey, average: a == null ? null : round1(a) };
  });
  const values = daily.map((d) => d.average).filter((v) => v != null);
  const average = values.length ? round1(avg(values)) : null;
  const half = Math.floor(daily.length / 2);
  const firstHalf = avg(
    daily
      .slice(0, half)
      .map((d) => d.average)
      .filter((v) => v != null),
  );
  const secondHalf = avg(
    daily
      .slice(daily.length - half)
      .map((d) => d.average)
      .filter((v) => v != null),
  );
  return { daily, average, direction: trendDirection(secondHalf, firstHalf) };
}

export function waterPerDay(entries, dateKeys) {
  const total = inDays(entries, 'water', dateKeys).reduce((sum, e) => sum + (Number(e.ml) || 0), 0);
  return { totalMl: total, averageMl: dateKeys.length ? Math.round(total / dateKeys.length) : 0 };
}

/** Every summary for one period of date keys. */
export function periodSummary({ entries, medications, dateKeys, now = new Date() }) {
  const doses = resolveDoses(
    expectedDoses(medications, dateKeys[0], dateKeys[dateKeys.length - 1]),
    entries,
    now,
  );
  return {
    startKey: dateKeys[0],
    endKey: dateKeys[dateKeys.length - 1],
    adherence: adherence(doses),
    meals: mealsCompleted(entries, dateKeys),
    activity: activityMinutes(entries, dateKeys),
    mood: moodTrend(entries, dateKeys),
    water: waterPerDay(entries, dateKeys),
  };
}

/** Last `days` days ending on endKey vs the `days` before that. */
export function compareSummary({ entries, medications, endKey, days = 7, now = new Date() }) {
  const current = periodSummary({ entries, medications, dateKeys: lastNDays(endKey, days), now });
  const previous = periodSummary({
    entries,
    medications,
    dateKeys: lastNDays(addDaysToKey(endKey, -days), days),
    now,
  });
  return {
    current,
    previous,
    moodDirection: trendDirection(current.mood.average, previous.mood.average),
  };
}

/** Today's progress for the nurse patient list. */
export function dayProgress({ entries, medications, dateKey, now = new Date() }) {
  const dayEntries = (entries ?? []).filter((e) => e.dateKey === dateKey);
  const doses = resolveDoses(expectedDoses(medications, dateKey), dayEntries, now);
  const count = (status) => doses.filter((d) => d.status === status).length;
  return {
    vitalsCount: dayEntries.filter((e) => e.type === 'vitals').length,
    dosesScheduled: doses.length,
    dosesGiven: count('given'),
    dosesNotGiven: count('missed') + count('refused') + count('held'),
    dosesNotRecorded: count('not_recorded'),
    dosesDue: doses.filter((d) => d.status !== 'pending').length,
  };
}
