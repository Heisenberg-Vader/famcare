// Entry types, their options and validation. Pure functions shared by forms, rules tests
// and the PDF report.
import { formatIST } from './time.js';

export const ENTRY_TYPES = Object.freeze([
  'vitals',
  'meal',
  'water',
  'medication',
  'activity',
  'mood',
  'observation',
]);

export const MEAL_SLOTS = Object.freeze(['breakfast', 'lunch', 'snack', 'dinner']);
export const PORTIONS = Object.freeze([0, 0.25, 0.5, 0.75, 1]);
export const DOSE_STATUSES = Object.freeze(['given', 'missed', 'refused', 'held']);
export const ACTIVITY_KINDS = Object.freeze(['walk', 'exercise', 'physio', 'outing', 'other']);
export const MOOD_TAGS = Object.freeze([
  'calm',
  'cheerful',
  'anxious',
  'agitated',
  'confused',
  'withdrawn',
  'sleepy',
  'tearful',
]);
export const SUGAR_CONTEXTS = Object.freeze(['fasting', 'post_meal', 'random']);
export const SEVERITIES = Object.freeze(['info', 'concern']);

export const LABELS = Object.freeze({
  vitals: 'Vitals',
  meal: 'Meal',
  water: 'Water',
  medication: 'Medicine',
  activity: 'Activity',
  mood: 'Mood',
  observation: 'Note',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  given: 'Given',
  missed: 'Missed',
  refused: 'Refused',
  held: 'Held',
  walk: 'Walk',
  exercise: 'Exercise',
  physio: 'Physio',
  outing: 'Outing',
  other: 'Other',
  fasting: 'Fasting',
  post_meal: 'After meal',
  random: 'Random',
  info: 'Info',
  concern: 'Concern',
});

export const label = (key) => LABELS[key] ?? key;

export const PORTION_LABELS = Object.freeze({
  0: 'None',
  0.25: '¼',
  0.5: '½',
  0.75: '¾',
  1: 'All',
});

/** Plausible input limits (typo guards, not clinical ranges). */
export const VITAL_LIMITS = Object.freeze({
  systolic: { min: 50, max: 260, step: 1 },
  diastolic: { min: 30, max: 160, step: 1 },
  pulse: { min: 25, max: 220, step: 1 },
  spo2: { min: 50, max: 100, step: 1 },
  sugar: { min: 20, max: 600, step: 1 },
  tempF: { min: 90, max: 110, step: 0.1 },
  weightKg: { min: 20, max: 250, step: 0.1 },
});

export const VITAL_KEYS = Object.freeze(Object.keys(VITAL_LIMITS));

const MAX_TEXT = 1000;

function toNumber(value) {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}

const cleanText = (s) => (typeof s === 'string' ? s.trim() : '');

/**
 * Validates and normalises the type-specific payload of an entry.
 * Returns { ok: true, value } or { ok: false, errors: { field: message } }.
 */
export function validatePayload(type, input = {}) {
  const errors = {};
  let value = {};

  switch (type) {
    case 'vitals': {
      for (const key of VITAL_KEYS) {
        const n = toNumber(input[key]);
        if (n == null) continue;
        const { min, max, step } = VITAL_LIMITS[key];
        if (Number.isNaN(n) || n < min || n > max) {
          errors[key] = `Enter ${min} to ${max}`;
        } else {
          value[key] = step < 1 ? Math.round(n * 10) / 10 : Math.round(n);
        }
      }
      if (value.systolic != null && value.diastolic != null && value.diastolic >= value.systolic) {
        errors.diastolic = 'Diastolic must be lower than systolic';
      }
      if ((value.systolic == null) !== (value.diastolic == null) && !errors.diastolic) {
        errors[value.systolic == null ? 'systolic' : 'diastolic'] = 'Enter both BP values';
      }
      if (value.sugar != null) {
        if (!SUGAR_CONTEXTS.includes(input.sugarContext)) errors.sugarContext = 'Choose when';
        else value.sugarContext = input.sugarContext;
      }
      if (Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
        errors.form = 'Enter at least one reading';
      }
      break;
    }
    case 'meal': {
      if (!MEAL_SLOTS.includes(input.slot)) errors.slot = 'Choose a meal';
      const items = cleanText(input.items);
      if (items.length > MAX_TEXT) errors.items = 'Too long';
      const portion = toNumber(input.portion);
      if (!PORTIONS.includes(portion)) errors.portion = 'Choose how much was eaten';
      value = { slot: input.slot, items, portion };
      break;
    }
    case 'water': {
      const ml = toNumber(input.ml);
      if (ml == null || Number.isNaN(ml) || ml < 10 || ml > 2000) errors.ml = 'Enter 10 to 2000 ml';
      value = { ml: Math.round(ml) };
      break;
    }
    case 'medication': {
      if (!input.medicationId) errors.medicationId = 'Missing medicine';
      if (!/^\d{2}:\d{2}$/.test(input.scheduledTime ?? '')) errors.scheduledTime = 'Missing time';
      if (!DOSE_STATUSES.includes(input.status)) errors.status = 'Choose a status';
      const reason = cleanText(input.reason);
      if (input.status && input.status !== 'given' && !reason) errors.reason = 'Give a reason';
      if (reason.length > MAX_TEXT) errors.reason = 'Too long';
      value = {
        medicationId: input.medicationId,
        medicationName: cleanText(input.medicationName),
        scheduledTime: input.scheduledTime,
        status: input.status,
        ...(input.status !== 'given' && reason ? { reason } : {}),
      };
      break;
    }
    case 'activity': {
      if (!ACTIVITY_KINDS.includes(input.kind)) errors.kind = 'Choose an activity';
      const minutes = toNumber(input.durationMin);
      if (minutes == null || Number.isNaN(minutes) || minutes < 1 || minutes > 600) {
        errors.durationMin = 'Enter 1 to 600 minutes';
      }
      const notes = cleanText(input.notes);
      if (notes.length > MAX_TEXT) errors.notes = 'Too long';
      value = { kind: input.kind, durationMin: Math.round(minutes), ...(notes ? { notes } : {}) };
      break;
    }
    case 'mood': {
      const score = toNumber(input.score);
      if (![1, 2, 3, 4, 5].includes(score)) errors.score = 'Choose a mood';
      const tags = [...new Set(input.tags ?? [])];
      if (tags.some((t) => !MOOD_TAGS.includes(t))) errors.tags = 'Unknown tag';
      value = { score, tags };
      break;
    }
    case 'observation': {
      const text = cleanText(input.text);
      if (!text) errors.text = 'Write the observation';
      if (text.length > MAX_TEXT) errors.text = 'Too long';
      if (!SEVERITIES.includes(input.severity)) errors.severity = 'Choose info or concern';
      value = { text, severity: input.severity };
      break;
    }
    default:
      errors.type = 'Unknown entry type';
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Mirrors the update rule: own entry, within 12 h of creation (a pending createdAt counts as now). */
export function canEditEntry(entry, uid, now = new Date()) {
  if (!entry || !uid || entry.nurseId !== uid) return false;
  const created = entry.createdAt ?? now;
  return now - created < EDIT_WINDOW_MS;
}

/** Suggests the meal slot from the IST time of day. */
export function defaultMealSlot(now = new Date()) {
  const hour = Number(formatIST(now, 'H'));
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}
