// Reference ranges for vitals: adult defaults, configurable per patient via
// patient.rangeOverrides. Not clinical advice.
import { addDaysToKey, toDate, toDateKey } from './time.js';

export const RANGES_DISCLAIMER = 'Reference ranges, configurable; not clinical advice.';

export const DEFAULT_RANGES = Object.freeze({
  systolic: { min: 90, max: 140 },
  diastolic: { min: 60, max: 90 },
  pulse: { min: 60, max: 100 },
  spo2: { min: 95, max: 100 },
  sugarFasting: { min: 70, max: 130 },
  sugarPostMeal: { min: 70, max: 180 },
  sugarRandom: { min: 70, max: 180 },
  tempF: { min: 97.0, max: 99.5 },
});

/** Display metadata for each vitals field stored on an entry. */
export const METRICS = Object.freeze({
  systolic: { label: 'Systolic', unit: 'mmHg' },
  diastolic: { label: 'Diastolic', unit: 'mmHg' },
  pulse: { label: 'Pulse', unit: 'bpm' },
  spo2: { label: 'SpO2', unit: '%' },
  sugar: { label: 'Blood sugar', unit: 'mg/dL' },
  tempF: { label: 'Temperature', unit: '°F' },
  weightKg: { label: 'Weight', unit: 'kg' },
});

export const VITAL_FIELDS = Object.freeze(Object.keys(METRICS));

export const WEIGHT_CHANGE_LIMIT_KG = 2;

const SUGAR_RANGE_KEY = {
  fasting: 'sugarFasting',
  post_meal: 'sugarPostMeal',
  random: 'sugarRandom',
};

/** Defaults merged with the patient's overrides. Invalid overrides are ignored. */
export function getRanges(patient) {
  const overrides = patient?.rangeOverrides ?? {};
  const ranges = { ...DEFAULT_RANGES };
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in DEFAULT_RANGES) || !value) continue;
    const min = Number.isFinite(value.min) ? value.min : ranges[key].min;
    const max = Number.isFinite(value.max) ? value.max : ranges[key].max;
    if (min <= max) ranges[key] = { min, max };
  }
  return ranges;
}

/** Range key for a metric; sugar depends on its context. Weight has no band. */
export function rangeKeyFor(metric, sugarContext) {
  if (metric === 'sugar') return SUGAR_RANGE_KEY[sugarContext] ?? 'sugarRandom';
  return metric in DEFAULT_RANGES ? metric : null;
}

export function getRange(metric, ctx = {}) {
  const key = rangeKeyFor(metric, ctx.sugarContext);
  if (!key) return null;
  return (ctx.ranges ?? DEFAULT_RANGES)[key] ?? null;
}

/**
 * classify(metric, value, ctx) -> 'low' | 'normal' | 'high'.
 * ctx: { sugarContext, ranges } where ranges comes from getRanges(patient).
 * Band limits count as normal. Metrics without a band (weight) are 'normal'.
 * Returns null when there is no numeric value.
 */
export function classify(metric, value, ctx = {}) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null;
  const range = getRange(metric, ctx);
  if (!range) return 'normal';
  const n = Number(value);
  if (n < range.min) return 'low';
  if (n > range.max) return 'high';
  return 'normal';
}

/** { metric: 'low'|'high' } for every out-of-range field on a vitals entry. */
export function outOfRangeFields(entry, ranges = DEFAULT_RANGES) {
  const result = {};
  if (entry?.type !== 'vitals') return result;
  for (const metric of VITAL_FIELDS) {
    const status = classify(metric, entry[metric], { sugarContext: entry.sugarContext, ranges });
    if (status === 'low' || status === 'high') result[metric] = status;
  }
  return result;
}

export function isOutOfRange(entry, ranges = DEFAULT_RANGES) {
  return Object.keys(outOfRangeFields(entry, ranges)).length > 0;
}

/**
 * Compares a weight reading with the latest reading dated 7 or more days earlier.
 * readings: vitals entries (any order) with weightKg, at and optionally dateKey.
 * Returns { previousKg, deltaKg, flagged } or null when there is nothing to compare.
 */
export function weightChange(current, readings) {
  if (!Number.isFinite(current?.weightKg)) return null;
  const currentKey = current.dateKey ?? toDateKey(current.at);
  const cutoff = addDaysToKey(currentKey, -7);
  let previous = null;
  for (const r of readings) {
    if (!Number.isFinite(r?.weightKg)) continue;
    const key = r.dateKey ?? toDateKey(r.at);
    if (key > cutoff) continue;
    if (!previous || toDate(r.at) > toDate(previous.at)) previous = r;
  }
  if (!previous) return null;
  const deltaKg = Math.round((current.weightKg - previous.weightKg) * 10) / 10;
  return {
    previousKg: previous.weightKg,
    deltaKg,
    flagged: Math.abs(deltaKg) > WEIGHT_CHANGE_LIMIT_KG,
  };
}
