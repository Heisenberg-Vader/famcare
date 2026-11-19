import { beforeEach, describe, expect, it } from 'vitest';
import { reportPeriod } from '../../lib/reportData.js';
import {
  CLOCK_SKEW_MS,
  affectsReport,
  clearReportCache,
  dropCachedReport,
  getCachedReport,
  putCachedReport,
  reportKey,
} from './reportCache.js';

const period = reportPeriod('2026-11-19');
const patient = { id: 'p', fullName: 'Kamla Devi', city: 'Jaipur', pending: false };
const meds = [
  { id: 'b', name: 'Metformin', times: ['09:00'] },
  { id: 'a', name: 'Amlodipine', times: ['08:00'] },
];

describe('reportKey', () => {
  it('ignores key order, list order and snapshot metadata', () => {
    const k1 = reportKey({ period, patient, medications: meds });
    const k2 = reportKey({
      period,
      patient: { city: 'Jaipur', fullName: 'Kamla Devi', pending: true },
      medications: [{ ...meds[1], pending: true }, meds[0]],
    });
    expect(k2).toBe(k1);
  });

  it('changes with the period, the ranges or the prescription', () => {
    const base = reportKey({ period, patient, medications: meds });
    expect(reportKey({ period: reportPeriod('2026-11-20'), patient, medications: meds })).not.toBe(
      base,
    );
    expect(
      reportKey({
        period,
        patient: { ...patient, rangeOverrides: { spo2: { min: 92, max: 100 } } },
        medications: meds,
      }),
    ).not.toBe(base);
    expect(
      reportKey({ period, patient, medications: [{ ...meds[0], times: ['09:00', '21:00'] }] }),
    ).not.toBe(base);
  });
});

describe('report cache', () => {
  beforeEach(() => clearReportCache());

  it('returns the stored PDF only for the same key and patient', () => {
    const readStartedAt = new Date('2026-11-19T10:00:00Z');
    const blob = new Blob(['%PDF']);
    putCachedReport('p', { key: 'k', period, readStartedAt, blob, fileName: 'r.pdf' });
    const hit = getCachedReport('p', 'k');
    expect(hit.blob).toBe(blob);
    expect(hit.checkFrom.getTime()).toBe(readStartedAt.getTime() - CLOCK_SKEW_MS);
    expect(getCachedReport('p', 'other')).toBeNull();
    expect(getCachedReport('q', 'k')).toBeNull();
    dropCachedReport('p');
    expect(getCachedReport('p', 'k')).toBeNull();
  });

  it('is invalidated only by changes inside the report range', () => {
    const cached = { startKey: period.fetchStartKey, endKey: period.endKey };
    expect(affectsReport(cached, [])).toBe(false);
    // Today's new entries are not in the report.
    expect(affectsReport(cached, [{ dateKey: '2026-11-19' }])).toBe(false);
    // An edit to yesterday's entry, or an offline entry for it synced late, is.
    expect(affectsReport(cached, [{ dateKey: '2026-11-18' }])).toBe(true);
    expect(affectsReport(cached, [{ dateKey: period.fetchStartKey }])).toBe(true);
  });
});
