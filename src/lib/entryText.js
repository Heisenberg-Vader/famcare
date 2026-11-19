// Human-readable summaries of entries, with flags for highlighting. Shared by the nurse
// list, the family timeline and the PDF report.
import { DEFAULT_RANGES, outOfRangeFields } from './ranges.js';
import { PORTION_LABELS, label } from './entries.js';

const MOOD_WORDS = { 1: 'Very low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Very good' };

export const moodWord = (score) => MOOD_WORDS[score] ?? String(score);

/** [{ key, text, flag }] for each reading on a vitals entry; flag is 'low'|'high'|null. */
export function vitalParts(entry, ranges = DEFAULT_RANGES) {
  const flags = outOfRangeFields(entry, ranges);
  const parts = [];
  if (entry.systolic != null || entry.diastolic != null) {
    parts.push({
      key: 'bp',
      text: `BP ${entry.systolic ?? '?'}/${entry.diastolic ?? '?'}`,
      flag: flags.systolic ?? flags.diastolic ?? null,
    });
  }
  const simple = [
    ['pulse', (v) => `Pulse ${v}`],
    ['spo2', (v) => `SpO2 ${v}%`],
    [
      'sugar',
      (v) =>
        `Sugar ${v} mg/dL${entry.sugarContext ? ` (${label(entry.sugarContext).toLowerCase()})` : ''}`,
    ],
    ['tempF', (v) => `Temp ${v}°F`],
    ['weightKg', (v) => `Weight ${v} kg`],
  ];
  for (const [key, fmt] of simple) {
    if (entry[key] != null) parts.push({ key, text: fmt(entry[key]), flag: flags[key] ?? null });
  }
  return parts;
}

/**
 * { title, detail, tone } where tone is 'alert' (out of range / concern),
 * 'warn' (missed or refused dose) or 'normal'.
 */
export function describeEntry(entry, ranges = DEFAULT_RANGES) {
  switch (entry.type) {
    case 'vitals': {
      const parts = vitalParts(entry, ranges);
      return {
        title: 'Vitals',
        detail: parts.map((p) => p.text).join(' · '),
        tone: parts.some((p) => p.flag) ? 'alert' : 'normal',
      };
    }
    case 'meal':
      return {
        title: `${label(entry.slot)}: ate ${PORTION_LABELS[entry.portion] ?? entry.portion}`,
        detail: entry.items || '',
        tone: 'normal',
      };
    case 'water':
      return { title: `Water ${entry.ml} ml`, detail: '', tone: 'normal' };
    case 'medication': {
      const tone = entry.status === 'given' ? 'normal' : 'warn';
      return {
        title: `${entry.medicationName} (${entry.scheduledTime}): ${label(entry.status).toLowerCase()}`,
        detail: entry.reason ?? '',
        tone,
      };
    }
    case 'activity':
      return {
        title: `${label(entry.kind)} ${entry.durationMin} min`,
        detail: entry.notes ?? '',
        tone: 'normal',
      };
    case 'mood':
      return {
        title: `Mood: ${moodWord(entry.score)} (${entry.score}/5)`,
        detail: (entry.tags ?? []).join(', '),
        tone: entry.score <= 2 ? 'warn' : 'normal',
      };
    case 'observation':
      return {
        title: entry.severity === 'concern' ? 'Concern' : 'Note',
        detail: entry.text,
        tone: entry.severity === 'concern' ? 'alert' : 'normal',
      };
    default:
      return { title: entry.type, detail: '', tone: 'normal' };
  }
}
