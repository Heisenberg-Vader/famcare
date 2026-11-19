import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timeline.js';
import { describeEntry } from './entryText.js';
import { dayProgress } from './summaries.js';
import { atIST } from './time.js';

const day = '2026-11-19';
const entries = [
  {
    id: 'v',
    type: 'vitals',
    dateKey: day,
    at: atIST(day, '08:15'),
    systolic: 160,
    diastolic: 85,
    spo2: 97,
  },
  {
    id: 'm',
    type: 'medication',
    dateKey: day,
    at: atIST(day, '08:10'),
    medicationId: 'a',
    medicationName: 'Amlodipine',
    scheduledTime: '08:00',
    status: 'missed',
    reason: 'Asleep',
  },
  {
    id: 'o',
    type: 'observation',
    dateKey: day,
    at: atIST(day, '07:00'),
    text: 'Fell',
    severity: 'concern',
  },
];
const medications = [
  {
    id: 'a',
    name: 'Amlodipine',
    strength: '5 mg',
    times: ['08:00'],
    startDate: '2026-01-01',
    active: true,
  },
  {
    id: 'b',
    name: 'Metformin',
    strength: '500 mg',
    times: ['09:00', '20:30'],
    startDate: '2026-01-01',
    active: true,
  },
];

describe('describeEntry', () => {
  it('flags out-of-range vitals, missed doses and concerns', () => {
    expect(describeEntry(entries[0]).tone).toBe('alert');
    expect(describeEntry(entries[0]).detail).toBe('BP 160/85 · SpO2 97%');
    expect(describeEntry(entries[1])).toMatchObject({ tone: 'warn', detail: 'Asleep' });
    expect(describeEntry(entries[2]).tone).toBe('alert');
    expect(describeEntry({ type: 'meal', slot: 'lunch', portion: 0.5, items: 'dal' }).title).toBe(
      'Lunch: ate ½',
    );
  });
});

describe('buildTimeline', () => {
  it('sorts entries and adds not-recorded doses', () => {
    const doses = [
      {
        key: 'b|2026-11-19|09:00',
        medicationName: 'Metformin',
        strength: '500 mg',
        scheduledTime: '09:00',
        scheduledAt: atIST(day, '09:00'),
        status: 'not_recorded',
      },
      {
        key: 'b|2026-11-19|20:30',
        medicationName: 'Metformin',
        scheduledTime: '20:30',
        scheduledAt: atIST(day, '20:30'),
        status: 'pending',
      },
    ];
    const items = buildTimeline({ entries, doses });
    expect(items.map((i) => i.key)).toEqual(['o', 'm', 'v', 'missing-b|2026-11-19|09:00']);
    expect(items[2].parts.find((p) => p.key === 'bp').flag).toBe('high');
    expect(items[3]).toMatchObject({ kind: 'missing', tone: 'missing' });
    expect(items[3].title).toMatch(/Metformin 500 mg \(09:00\): not recorded/);
  });
});

describe('dayProgress', () => {
  it('counts vitals and doses for the day', () => {
    const p = dayProgress({ entries, medications, dateKey: day, now: atIST(day, '12:00') });
    expect(p).toEqual({
      vitalsCount: 1,
      dosesScheduled: 3,
      dosesGiven: 0,
      dosesNotGiven: 1,
      dosesNotRecorded: 1,
      dosesDue: 2,
    });
  });
});
