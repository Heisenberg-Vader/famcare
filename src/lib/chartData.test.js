import { describe, expect, it } from 'vitest';
import { CHART_METRICS, buildChart, mergeToday, seriesStats } from './chartData.js';
import { getRanges } from './ranges.js';
import { atIST, dayRange } from './time.js';

const metric = (id) => CHART_METRICS.find((m) => m.id === id);
const v = (dateKey, time, fields) => ({
  type: 'vitals',
  dateKey,
  at: atIST(dateKey, time),
  ...fields,
});
const span = {
  startMs: dayRange('2026-11-13').start.getTime(),
  endMs: dayRange('2026-11-19').end.getTime(),
};

describe('buildChart', () => {
  it('BP: both series in one point, flags and bands', () => {
    const chart = buildChart(
      metric('bp'),
      [
        v('2026-11-18', '08:00', { systolic: 158, diastolic: 96 }),
        v('2026-11-17', '08:00', { systolic: 128, diastolic: 80 }),
      ],
      span,
    );
    expect(
      chart.points.map((p) => [p.systolic, p.systolicFlag, p.diastolic, p.diastolicFlag]),
    ).toEqual([
      [128, null, 80, null],
      [158, 'high', 96, 'high'],
    ]);
    expect(chart.bands).toEqual([
      { seriesKey: 'systolic', label: 'Systolic', min: 90, max: 140 },
      { seriesKey: 'diastolic', label: 'Diastolic', min: 60, max: 90 },
    ]);
    expect(chart.outOfRange).toBe(2);
    expect(chart.domain[0]).toBeLessThanOrEqual(60);
    expect(chart.domain[1]).toBeGreaterThanOrEqual(158);
  });

  it('sugar: splits by context and uses the right band, with overrides', () => {
    const ranges = getRanges({ rangeOverrides: { sugarFasting: { min: 80, max: 140 } } });
    const chart = buildChart(
      metric('sugar'),
      [
        v('2026-11-18', '08:00', { sugar: 135, sugarContext: 'fasting' }),
        v('2026-11-18', '21:00', { sugar: 175, sugarContext: 'post_meal' }),
        v('2026-11-19', '21:00', { sugar: 190, sugarContext: 'random' }),
      ],
      { ...span, ranges },
    );
    expect(chart.readings.map((r) => [r.seriesKey, r.value, r.flag])).toEqual([
      ['sugarFasting', 135, null],
      ['sugarOther', 175, null],
      ['sugarOther', 190, 'high'],
    ]);
    expect(chart.bands[0]).toMatchObject({ seriesKey: 'sugarFasting', min: 80, max: 140 });
  });

  it('weight: no band, flags a change over 2 kg using readings before the window', () => {
    const chart = buildChart(
      metric('weightKg'),
      [v('2026-11-08', '08:00', { weightKg: 60 }), v('2026-11-16', '08:00', { weightKg: 62.5 })],
      span,
    );
    expect(chart.bands).toEqual([]);
    expect(chart.readings).toHaveLength(1);
    expect(chart.readings[0]).toMatchObject({ flag: 'change', note: '+2.5 kg vs 7 days earlier' });
  });

  it('ignores readings outside the window and non-vitals', () => {
    const chart = buildChart(
      metric('pulse'),
      [
        v('2026-11-01', '08:00', { pulse: 70 }),
        { type: 'water', ml: 200, at: atIST('2026-11-18', '08:00') },
      ],
      span,
    );
    expect(chart.points).toEqual([]);
    expect(chart.outOfRange).toBe(0);
  });

  it('computes per-series stats', () => {
    const chart = buildChart(
      metric('spo2'),
      [
        v('2026-11-15', '08:00', { spo2: 97 }),
        v('2026-11-16', '08:00', { spo2: 91 }),
        v('2026-11-17', '08:00', { spo2: 98 }),
      ],
      span,
    );
    expect(seriesStats(chart)).toEqual([
      {
        seriesKey: 'spo2',
        label: 'SpO2',
        count: 3,
        min: 91,
        max: 98,
        average: 95.3,
        outOfRange: 1,
      },
    ]);
  });
});

describe('mergeToday', () => {
  it('replaces the fetched copy of today with the live one', () => {
    const merged = mergeToday(
      [
        { id: 'a', dateKey: '2026-11-18' },
        { id: 'old', dateKey: '2026-11-19' },
      ],
      [{ id: 'new', dateKey: '2026-11-19' }],
      '2026-11-19',
    );
    expect(merged.map((e) => e.id)).toEqual(['a', 'new']);
  });
});
