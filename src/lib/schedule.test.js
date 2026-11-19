import { describe, expect, it } from 'vitest';
import { expectedDoses, groupBySlot, resolveDoses, slotFor } from './schedule.js';

const meds = [
  {
    id: 'met',
    name: 'Metformin',
    times: ['08:00', '20:00'],
    startDate: '2026-11-01',
    endDate: null,
    active: true,
  },
  {
    id: 'aml',
    name: 'Amlodipine',
    times: ['08:00'],
    startDate: '2026-11-18',
    endDate: null,
    active: true,
  },
  {
    id: 'abx',
    name: 'Antibiotic',
    times: ['14:00'],
    startDate: '2026-11-01',
    endDate: '2026-11-17',
    active: true,
  },
  {
    id: 'old',
    name: 'Stopped',
    times: ['22:00'],
    startDate: '2026-01-01',
    endDate: null,
    active: false,
  },
];

describe('slotFor', () => {
  it('maps clock times to slots', () => {
    expect(slotFor('05:00')).toBe('Morning');
    expect(slotFor('11:59')).toBe('Morning');
    expect(slotFor('14:00')).toBe('Afternoon');
    expect(slotFor('20:00')).toBe('Evening');
    expect(slotFor('22:00')).toBe('Night');
    expect(slotFor('02:00')).toBe('Night');
  });
});

describe('expectedDoses', () => {
  it('respects start date, end date and active flag', () => {
    const d17 = expectedDoses(meds, '2026-11-17');
    expect(d17.map((d) => `${d.medicationId}@${d.scheduledTime}`)).toEqual([
      'met@08:00',
      'abx@14:00',
      'met@20:00',
    ]);
    const d18 = expectedDoses(meds, '2026-11-18');
    expect(d18.map((d) => d.medicationId).sort()).toEqual(['aml', 'met', 'met']);
  });

  it('expands over a range with IST scheduled instants', () => {
    const doses = expectedDoses(meds, '2026-11-18', '2026-11-19');
    expect(doses).toHaveLength(6);
    expect(doses[0].scheduledAt.toISOString()).toBe('2026-11-18T02:30:00.000Z');
    expect(doses[0].slot).toBe('Morning');
  });
});

describe('resolveDoses', () => {
  const doses = expectedDoses(meds, '2026-11-18');
  const entries = [
    {
      type: 'medication',
      medicationId: 'met',
      dateKey: '2026-11-18',
      scheduledTime: '08:00',
      status: 'given',
      at: new Date('2026-11-18T02:40:00Z'),
    },
    {
      type: 'medication',
      medicationId: 'aml',
      dateKey: '2026-11-18',
      scheduledTime: '08:00',
      status: 'refused',
      at: new Date('2026-11-18T02:45:00Z'),
    },
  ];

  it('uses logged status, then not_recorded 2 h after the dose, else pending', () => {
    // 21:59 IST: 20:00 dose is 1 h 59 min overdue -> pending.
    let byKey = Object.fromEntries(
      resolveDoses(doses, entries, new Date('2026-11-18T16:29:00Z')).map((d) => [
        `${d.medicationId}@${d.scheduledTime}`,
        d.status,
      ]),
    );
    expect(byKey).toEqual({ 'met@08:00': 'given', 'aml@08:00': 'refused', 'met@20:00': 'pending' });
    // 22:00 IST -> not_recorded.
    byKey = Object.fromEntries(
      resolveDoses(doses, entries, new Date('2026-11-18T16:30:00Z')).map((d) => [
        `${d.medicationId}@${d.scheduledTime}`,
        d.status,
      ]),
    );
    expect(byKey['met@20:00']).toBe('not_recorded');
  });

  it('groups by slot in order', () => {
    expect(groupBySlot(doses).map((g) => [g.slot, g.doses.length])).toEqual([
      ['Morning', 2],
      ['Evening', 1],
    ]);
  });
});
