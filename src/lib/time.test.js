import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  ageFromDob,
  atIST,
  dateKeysBetween,
  dayRange,
  formatClock,
  formatDateKey,
  formatTime,
  lastNDays,
  toDate,
  toDateKey,
} from './time.js';

describe('toDateKey', () => {
  it('uses the IST date for times between 00:00 and 05:30 IST', () => {
    // 2026-11-18 19:00 UTC is 2026-11-19 00:30 IST.
    expect(toDateKey(new Date('2026-11-18T19:00:00Z'))).toBe('2026-11-19');
    // 05:29 IST is still the same IST day, but the previous UTC day.
    expect(toDateKey(new Date('2026-11-18T23:59:00Z'))).toBe('2026-11-19');
  });

  it('keeps 23:59 IST on the same day', () => {
    expect(toDateKey(new Date('2026-11-18T18:29:00Z'))).toBe('2026-11-18');
  });

  it('accepts Firestore-like timestamps', () => {
    const ts = { toDate: () => new Date('2026-11-18T19:00:00Z') };
    expect(toDateKey(ts)).toBe('2026-11-19');
    expect(toDate({ seconds: 0 })).toEqual(new Date(0));
  });
});

describe('dayRange and atIST', () => {
  it('starts at IST midnight and spans 24 hours', () => {
    const { start, end } = dayRange('2026-11-19');
    expect(start.toISOString()).toBe('2026-11-18T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-19T18:30:00.000Z');
  });

  it('converts an IST clock time to an instant', () => {
    expect(atIST('2026-11-19', '08:00').toISOString()).toBe('2026-11-19T02:30:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(() => atIST('19-11-2026')).toThrow();
    expect(() => atIST('2026-11-19', '25:00')).toThrow();
  });
});

describe('date key arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('lists inclusive ranges', () => {
    expect(dateKeysBetween('2026-11-29', '2026-12-02')).toEqual([
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ]);
    expect(lastNDays('2026-11-19', 7)).toHaveLength(7);
    expect(lastNDays('2026-11-19', 7)[0]).toBe('2026-11-13');
  });
});

describe('formatting', () => {
  it('formats in IST', () => {
    expect(formatTime(new Date('2026-11-19T02:35:00Z'))).toBe('8:05 AM');
    expect(formatDateKey('2026-11-19', 'EEE, d MMM')).toBe('Thu, 19 Nov');
    expect(formatClock('00:15')).toBe('12:15 AM');
    expect(formatClock('20:00')).toBe('8:00 PM');
  });

  it('computes age on the IST date', () => {
    expect(ageFromDob('1948-11-19', new Date('2026-11-18T19:00:00Z'))).toBe(78);
    expect(ageFromDob('1948-11-20', new Date('2026-11-18T19:00:00Z'))).toBe(77);
  });
});
