import { describe, expect, it } from 'vitest';
import { dayFlags, monthBounds } from './dayFlags.js';
import { atIST } from './time.js';

const meds = [
  { id: 'm', name: 'Metformin', times: ['09:00'], startDate: '2026-11-01', active: true },
];
const given = (dateKey) => ({
  type: 'medication',
  medicationId: 'm',
  dateKey,
  scheduledTime: '09:00',
  status: 'given',
  at: atIST(dateKey, '09:05'),
});

describe('dayFlags', () => {
  it('flags out-of-range vitals and dose problems, honouring overrides', () => {
    const entries = [
      given('2026-11-16'),
      { type: 'vitals', dateKey: '2026-11-16', at: atIST('2026-11-16', '08:00'), spo2: 91 },
      { ...given('2026-11-17'), status: 'missed', reason: 'Asleep' },
      given('2026-11-18'),
      {
        type: 'vitals',
        dateKey: '2026-11-18',
        at: atIST('2026-11-18', '08:00'),
        sugar: 135,
        sugarContext: 'fasting',
      },
    ];
    const keys = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
    const now = atIST('2026-11-19', '10:00');
    const flags = dayFlags({ entries, medications: meds, dateKeys: keys, now });
    expect(Object.fromEntries(flags)).toEqual({
      '2026-11-16': { outOfRange: true, doseIssue: false },
      '2026-11-17': { outOfRange: false, doseIssue: true },
      '2026-11-18': { outOfRange: true, doseIssue: false },
    });
    // 09:00 dose today is 1 h overdue: still pending, not flagged.
    expect(flags.has('2026-11-19')).toBe(false);

    const relaxed = dayFlags({
      entries,
      medications: meds,
      patient: { rangeOverrides: { sugarFasting: { min: 80, max: 140 } } },
      dateKeys: keys,
      now,
    });
    expect(relaxed.has('2026-11-18')).toBe(false);
  });

  it('flags a dose with no entry once it is overdue', () => {
    const flags = dayFlags({
      entries: [],
      medications: meds,
      dateKeys: ['2026-11-19'],
      now: atIST('2026-11-19', '11:30'),
    });
    expect(flags.get('2026-11-19')).toEqual({ outOfRange: false, doseIssue: true });
  });
});

describe('monthBounds', () => {
  it('handles month lengths and caps at today', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthBounds('2026-11', '2026-11-19')).toEqual({
      start: '2026-11-01',
      end: '2026-11-19',
    });
  });
});
