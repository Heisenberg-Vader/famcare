import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANGES,
  classify,
  getRanges,
  isOutOfRange,
  outOfRangeFields,
  weightChange,
} from './ranges.js';

describe('classify', () => {
  it('treats band limits as normal', () => {
    expect(classify('systolic', 140)).toBe('normal');
    expect(classify('systolic', 141)).toBe('high');
    expect(classify('diastolic', 59)).toBe('low');
    expect(classify('spo2', 95)).toBe('normal');
    expect(classify('spo2', 94)).toBe('low');
    expect(classify('tempF', 99.6)).toBe('high');
  });

  it('uses the sugar context', () => {
    expect(classify('sugar', 150, { sugarContext: 'fasting' })).toBe('high');
    expect(classify('sugar', 150, { sugarContext: 'post_meal' })).toBe('normal');
    expect(classify('sugar', 150, { sugarContext: 'random' })).toBe('normal');
    expect(classify('sugar', 190)).toBe('high');
  });

  it('has no band for weight and returns null without a value', () => {
    expect(classify('weightKg', 120)).toBe('normal');
    expect(classify('pulse', null)).toBeNull();
    expect(classify('pulse', '')).toBeNull();
  });
});

describe('getRanges', () => {
  it('applies valid patient overrides and ignores invalid ones', () => {
    const ranges = getRanges({
      rangeOverrides: { spo2: { min: 92, max: 100 }, pulse: { min: 120, max: 50 }, bogus: {} },
    });
    expect(ranges.spo2).toEqual({ min: 92, max: 100 });
    expect(ranges.pulse).toEqual(DEFAULT_RANGES.pulse);
    expect(ranges).not.toHaveProperty('bogus');
    expect(classify('spo2', 93, { ranges })).toBe('normal');
  });

  it('returns defaults without overrides', () => {
    expect(getRanges(undefined)).toEqual(DEFAULT_RANGES);
  });
});

describe('outOfRangeFields', () => {
  it('lists only out-of-range fields of vitals entries', () => {
    const entry = { type: 'vitals', systolic: 160, diastolic: 85, spo2: 91, sugar: 120 };
    expect(outOfRangeFields(entry)).toEqual({ systolic: 'high', spo2: 'low' });
    expect(isOutOfRange(entry)).toBe(true);
    expect(isOutOfRange({ type: 'meal', systolic: 200 })).toBe(false);
  });
});

describe('weightChange', () => {
  const readings = [
    { weightKg: 60, dateKey: '2026-11-01', at: new Date('2026-11-01T03:00:00Z') },
    { weightKg: 61, dateKey: '2026-11-10', at: new Date('2026-11-10T03:00:00Z') },
    { weightKg: 64, dateKey: '2026-11-15', at: new Date('2026-11-15T03:00:00Z') },
  ];

  it('compares with the latest reading at least 7 days earlier', () => {
    const current = { weightKg: 63.5, dateKey: '2026-11-17' };
    expect(weightChange(current, readings)).toEqual({
      previousKg: 61,
      deltaKg: 2.5,
      flagged: true,
    });
  });

  it('does not flag a change of 2 kg or less', () => {
    expect(weightChange({ weightKg: 62, dateKey: '2026-11-17' }, readings).flagged).toBe(false);
  });

  it('returns null without an earlier reading', () => {
    expect(weightChange({ weightKg: 62, dateKey: '2026-11-05' }, readings)).toBeNull();
  });
});
