import { describe, expect, it } from 'vitest';
import { isInNurseWindow, nurseWindow } from './scope.js';

describe('nurseWindow', () => {
  it('covers yesterday and today in IST', () => {
    // 2026-11-19 00:30 IST
    const now = new Date('2026-11-18T19:00:00Z');
    const w = nurseWindow(now);
    expect(w.dateKeys).toEqual(['2026-11-18', '2026-11-19']);
    expect(w.since.toISOString()).toBe('2026-11-17T18:30:00.000Z');
    expect(isInNurseWindow('2026-11-17', now)).toBe(false);
  });

  it('never starts more than 48 hours back (rules allow 50)', () => {
    const now = new Date('2026-11-19T18:29:00Z'); // 23:59 IST
    expect(now - nurseWindow(now).since).toBeLessThan(48 * 60 * 60 * 1000);
  });
});
