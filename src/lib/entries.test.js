import { describe, expect, it } from 'vitest';
import { EDIT_WINDOW_MS, canEditEntry, defaultMealSlot, validatePayload } from './entries.js';

describe('validatePayload', () => {
  it('vitals: needs at least one reading, both BP values and sane numbers', () => {
    expect(validatePayload('vitals', {}).errors.form).toBeTruthy();
    expect(validatePayload('vitals', { systolic: '130' }).errors.diastolic).toMatch(/both/);
    expect(validatePayload('vitals', { systolic: 120, diastolic: 130 }).errors.diastolic).toMatch(
      /lower/,
    );
    expect(validatePayload('vitals', { spo2: 140 }).errors.spo2).toMatch(/50 to 100/);
    const ok = validatePayload('vitals', {
      systolic: '128',
      diastolic: '82',
      tempF: '98.64',
      sugar: '',
      pulse: '',
    });
    expect(ok).toEqual({ ok: true, value: { systolic: 128, diastolic: 82, tempF: 98.6 } });
  });

  it('vitals: sugar needs a context', () => {
    expect(validatePayload('vitals', { sugar: 140 }).errors.sugarContext).toBeTruthy();
    expect(validatePayload('vitals', { sugar: 140, sugarContext: 'fasting' }).value).toEqual({
      sugar: 140,
      sugarContext: 'fasting',
    });
  });

  it('medication: non-given statuses need a reason; given drops it', () => {
    const base = { medicationId: 'm', medicationName: 'Metformin', scheduledTime: '08:00' };
    expect(validatePayload('medication', { ...base, status: 'missed' }).errors.reason).toBeTruthy();
    expect(
      validatePayload('medication', { ...base, status: 'refused', reason: ' Spat out ' }).value
        .reason,
    ).toBe('Spat out');
    expect(
      validatePayload('medication', { ...base, status: 'given', reason: 'old' }).value,
    ).not.toHaveProperty('reason');
  });

  it('meal, water, activity, mood and observation', () => {
    expect(validatePayload('meal', { slot: 'lunch', portion: 0.75, items: ' dal ' }).value).toEqual(
      {
        slot: 'lunch',
        portion: 0.75,
        items: 'dal',
      },
    );
    expect(validatePayload('meal', { slot: 'brunch', portion: 0.3 }).errors).toHaveProperty('slot');
    expect(validatePayload('water', { ml: 5 }).ok).toBe(false);
    expect(validatePayload('water', { ml: '250' }).value).toEqual({ ml: 250 });
    expect(validatePayload('activity', { kind: 'walk', durationMin: 0 }).ok).toBe(false);
    expect(validatePayload('mood', { score: 4, tags: ['calm', 'calm'] }).value).toEqual({
      score: 4,
      tags: ['calm'],
    });
    expect(validatePayload('mood', { score: 6 }).ok).toBe(false);
    expect(validatePayload('observation', { text: '  ', severity: 'info' }).ok).toBe(false);
    expect(validatePayload('nonsense', {}).ok).toBe(false);
  });
});

describe('canEditEntry', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  it('allows own entries within 12 hours', () => {
    expect(canEditEntry({ nurseId: 'a', createdAt: new Date(now - 3600e3) }, 'a', now)).toBe(true);
    expect(
      canEditEntry({ nurseId: 'a', createdAt: new Date(now - EDIT_WINDOW_MS) }, 'a', now),
    ).toBe(false);
    expect(canEditEntry({ nurseId: 'b', createdAt: now }, 'a', now)).toBe(false);
    expect(canEditEntry({ nurseId: 'a' }, 'a', now)).toBe(true);
  });
});

describe('defaultMealSlot', () => {
  it('uses the IST hour', () => {
    expect(defaultMealSlot(new Date('2026-11-19T02:30:00Z'))).toBe('breakfast'); // 08:00
    expect(defaultMealSlot(new Date('2026-11-19T07:30:00Z'))).toBe('lunch'); // 13:00
    expect(defaultMealSlot(new Date('2026-11-19T11:00:00Z'))).toBe('snack'); // 16:30
    expect(defaultMealSlot(new Date('2026-11-19T14:30:00Z'))).toBe('dinner'); // 20:00
  });
});
