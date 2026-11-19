import { describe, expect, it } from 'vitest';
import {
  activityMinutes,
  adherence,
  adherenceByMedication,
  compareSummary,
  mealsCompleted,
  moodTrend,
  trendDirection,
  waterPerDay,
} from './summaries.js';
import { atIST, lastNDays } from './time.js';

const days = ['2026-11-17', '2026-11-18'];

describe('adherence', () => {
  it('excludes pending doses and counts not recorded separately', () => {
    const doses = [
      { medicationId: 'a', medicationName: 'A', status: 'given' },
      { medicationId: 'a', medicationName: 'A', status: 'given' },
      { medicationId: 'b', medicationName: 'B', status: 'missed' },
      { medicationId: 'b', medicationName: 'B', status: 'not_recorded' },
      { medicationId: 'b', medicationName: 'B', status: 'pending' },
    ];
    expect(adherence(doses)).toMatchObject({
      given: 2,
      missed: 1,
      notRecorded: 1,
      pending: 1,
      expected: 4,
      percent: 50,
    });
    const perMed = adherenceByMedication(doses);
    expect(perMed.map((m) => [m.medicationName, m.percent])).toEqual([
      ['A', 100],
      ['B', 0],
    ]);
  });

  it('returns null percent when nothing is due', () => {
    expect(adherence([]).percent).toBeNull();
  });
});

describe('mealsCompleted', () => {
  it('counts main meals with portion >= 0.75, best portion per slot', () => {
    const entries = [
      { type: 'meal', dateKey: days[0], slot: 'breakfast', portion: 1 },
      { type: 'meal', dateKey: days[0], slot: 'lunch', portion: 0.5 },
      { type: 'meal', dateKey: days[0], slot: 'lunch', portion: 0.75 },
      { type: 'meal', dateKey: days[0], slot: 'snack', portion: 1 },
      { type: 'meal', dateKey: days[1], slot: 'dinner', portion: 0.25 },
      { type: 'meal', dateKey: '2026-11-10', slot: 'dinner', portion: 1 },
    ];
    expect(mealsCompleted(entries, days)).toEqual({ completed: 2, expected: 6, percent: 33 });
  });
});

describe('activity and water', () => {
  const entries = [
    { type: 'activity', dateKey: days[0], durationMin: 20 },
    { type: 'activity', dateKey: days[0], durationMin: 15 },
    { type: 'activity', dateKey: days[1], durationMin: 30 },
    { type: 'water', dateKey: days[0], ml: 250 },
    { type: 'water', dateKey: days[1], ml: 500 },
  ];

  it('sums activity minutes per day', () => {
    expect(activityMinutes(entries, days)).toEqual({
      total: 65,
      perDay: [
        { dateKey: days[0], minutes: 35 },
        { dateKey: days[1], minutes: 30 },
      ],
      averagePerDay: 32.5,
    });
  });

  it('averages water over all days in the period', () => {
    expect(waterPerDay(entries, [...days, '2026-11-19'])).toEqual({ totalMl: 750, averageMl: 250 });
  });
});

describe('mood', () => {
  it('averages per day and finds the direction', () => {
    const keys = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'];
    const entries = [
      { type: 'mood', dateKey: keys[0], score: 2 },
      { type: 'mood', dateKey: keys[0], score: 3 },
      { type: 'mood', dateKey: keys[1], score: 2 },
      { type: 'mood', dateKey: keys[3], score: 4 },
    ];
    const trend = moodTrend(entries, keys);
    expect(trend.daily.map((d) => d.average)).toEqual([2.5, 2, null, 4]);
    expect(trend.average).toBe(2.8);
    expect(trend.direction).toBe('up');
  });

  it('treats small changes as flat', () => {
    expect(trendDirection(3.1, 3)).toBe('flat');
    expect(trendDirection(2.5, 3)).toBe('down');
    expect(trendDirection(null, 3)).toBeNull();
  });
});

describe('compareSummary', () => {
  it('compares the last 7 days with the previous 7', () => {
    const endKey = '2026-11-18';
    const medications = [
      { id: 'm', name: 'Med', times: ['08:00'], startDate: '2026-11-01', active: true },
    ];
    const entries = [];
    for (const k of lastNDays(endKey, 14)) {
      const recent = k > '2026-11-11';
      entries.push({ type: 'mood', dateKey: k, score: recent ? 4 : 2 });
      if (recent || k < '2026-11-09') {
        entries.push({
          type: 'medication',
          medicationId: 'm',
          dateKey: k,
          scheduledTime: '08:00',
          status: 'given',
          at: atIST(k, '08:10'),
        });
      }
    }
    const result = compareSummary({ entries, medications, endKey, now: atIST(endKey, '23:00') });
    expect(result.current.startKey).toBe('2026-11-12');
    expect(result.previous.endKey).toBe('2026-11-11');
    expect(result.current.adherence.percent).toBe(100);
    expect(result.previous.adherence).toMatchObject({ given: 4, notRecorded: 3, expected: 7 });
    expect(result.moodDirection).toBe('up');
  });
});
