// Expands each patient's medication schedule into the doses expected on given days,
// and matches them with logged medication entries.
import { atIST, dateKeysBetween, toDate } from './time.js';

/** Hours after the scheduled time before an unlogged dose counts as "not recorded". */
export const NOT_RECORDED_AFTER_HOURS = 2;

export const SLOTS = Object.freeze(['Morning', 'Afternoon', 'Evening', 'Night']);

/** Morning 05:00-11:59, Afternoon 12:00-16:59, Evening 17:00-20:59, Night 21:00-04:59. */
export function slotFor(time) {
  const hour = Number(time.split(':')[0]);
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

export function isMedicationActiveOn(med, dateKey) {
  if (!med || med.active === false) return false;
  if (med.startDate && dateKey < med.startDate) return false;
  if (med.endDate && dateKey > med.endDate) return false;
  return true;
}

export function doseKey(medicationId, dateKey, scheduledTime) {
  return `${medicationId}|${dateKey}|${scheduledTime}`;
}

/**
 * Expected doses for every day from startKey to endKey (inclusive), sorted by time.
 * medications: [{ id, name, strength, dose, times: ['08:00'], startDate, endDate, active }]
 */
export function expectedDoses(medications, startKey, endKey = startKey) {
  const doses = [];
  for (const dateKey of dateKeysBetween(startKey, endKey)) {
    for (const med of medications ?? []) {
      if (!isMedicationActiveOn(med, dateKey)) continue;
      for (const scheduledTime of med.times ?? []) {
        doses.push({
          key: doseKey(med.id, dateKey, scheduledTime),
          medicationId: med.id,
          medicationName: med.name,
          strength: med.strength,
          dose: med.dose,
          route: med.route,
          instructions: med.instructions,
          dateKey,
          scheduledTime,
          scheduledAt: atIST(dateKey, scheduledTime),
          slot: slotFor(scheduledTime),
        });
      }
    }
  }
  return doses.sort(
    (a, b) =>
      a.scheduledAt - b.scheduledAt || String(a.medicationName).localeCompare(b.medicationName),
  );
}

/** Latest medication entry per dose key. */
export function indexMedicationEntries(entries) {
  const index = new Map();
  for (const e of entries ?? []) {
    if (e?.type !== 'medication') continue;
    const key = doseKey(e.medicationId, e.dateKey, e.scheduledTime);
    const prev = index.get(key);
    if (!prev || toDate(e.updatedAt ?? e.at) >= toDate(prev.updatedAt ?? prev.at)) {
      index.set(key, e);
    }
  }
  return index;
}

/**
 * Attaches a status to each expected dose:
 * the logged status ('given'|'missed'|'refused'|'held'), else 'not_recorded' once
 * NOT_RECORDED_AFTER_HOURS have passed since the scheduled time, else 'pending'.
 */
export function resolveDoses(doses, entries, now = new Date()) {
  const index = indexMedicationEntries(entries);
  const graceMs = NOT_RECORDED_AFTER_HOURS * 60 * 60 * 1000;
  return doses.map((dose) => {
    const entry = index.get(dose.key) ?? null;
    let status = entry?.status;
    if (!status) status = now - dose.scheduledAt >= graceMs ? 'not_recorded' : 'pending';
    return { ...dose, entry, status };
  });
}

/** [{ slot, doses }] in SLOTS order, omitting empty slots. */
export function groupBySlot(doses) {
  return SLOTS.map((slot) => ({ slot, doses: doses.filter((d) => d.slot === slot) })).filter(
    (g) => g.doses.length > 0,
  );
}
