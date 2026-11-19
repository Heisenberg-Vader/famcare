import { describe, expect, it } from 'vitest';
import { buildReportData, reportPeriod } from './reportData.js';
import { getRanges } from './ranges.js';
import { atIST, lastNDays } from './time.js';

const TODAY = '2026-11-19';
const NOW = atIST(TODAY, '15:00');
const meds = [
  {
    id: 'met',
    name: 'Metformin',
    strength: '500 mg',
    times: ['09:00', '20:30'],
    startDate: '2026-01-01',
    active: true,
  },
];
const patient = {
  fullName: 'Kamla Devi',
  dob: '1948-03-02',
  gender: 'female',
  city: 'Jaipur',
  conditions: ['Hypertension'],
  nurses: [{ id: 'n1', fullName: 'Anita Sharma' }],
  rangeOverrides: { sugarFasting: { min: 80, max: 140 } },
};

const dose = (dateKey, time, status, extra = {}) => ({
  type: 'medication',
  medicationId: 'met',
  medicationName: 'Metformin',
  scheduledTime: time,
  status,
  dateKey,
  at: atIST(dateKey, time),
  nurseName: 'Ravi Kumar',
  ...extra,
});

function fixtures() {
  const days = lastNDays('2026-11-18', 30);
  const entries = [];
  for (const k of days) {
    entries.push(dose(k, '09:00', 'given'));
    if (k === '2026-11-17') {
      entries.push(dose(k, '20:30', 'missed', { reason: 'Strip finished' }));
    } else if (k !== '2026-11-14') {
      entries.push(dose(k, '20:30', 'given'));
    }
    entries.push({
      type: 'meal',
      slot: 'breakfast',
      portion: 1,
      dateKey: k,
      at: atIST(k, '08:30'),
    });
    entries.push({ type: 'water', ml: 1000, dateKey: k, at: atIST(k, '11:00') });
    entries.push({
      type: 'vitals',
      systolic: k === '2026-11-09' ? 158 : 128,
      diastolic: k === '2026-11-09' ? 96 : 80,
      sugar: 135,
      sugarContext: 'fasting',
      dateKey: k,
      at: atIST(k, '08:00'),
    });
  }
  // Outside the period: the day before it starts (weight baseline) and today.
  entries.push({
    type: 'vitals',
    weightKg: 60,
    dateKey: '2026-10-14',
    at: atIST('2026-10-14', '08:00'),
  });
  entries.push({
    type: 'vitals',
    weightKg: 57.5,
    dateKey: '2026-10-21',
    at: atIST('2026-10-21', '08:00'),
  });
  entries.push({ type: 'vitals', spo2: 88, dateKey: TODAY, at: atIST(TODAY, '08:00') });
  entries.push({
    type: 'observation',
    severity: 'concern',
    text: 'BP high, doctor informed',
    nurseName: 'Anita Sharma',
    dateKey: '2026-11-09',
    at: atIST('2026-11-09', '09:00'),
  });
  entries.push({
    type: 'observation',
    severity: 'info',
    text: 'Calm day',
    dateKey: '2026-11-10',
    at: atIST('2026-11-10', '09:00'),
  });
  return entries;
}

describe('reportPeriod', () => {
  it('covers the 30 full days before today plus a 7-day lookback for weight', () => {
    expect(reportPeriod(TODAY)).toMatchObject({
      startKey: '2026-10-20',
      endKey: '2026-11-18',
      fetchStartKey: '2026-10-13',
    });
    expect(reportPeriod(TODAY).dateKeys).toHaveLength(30);
  });
});

describe('buildReportData', () => {
  const data = buildReportData({
    patient,
    medications: meds,
    entries: fixtures(),
    today: TODAY,
    now: NOW,
    ranges: getRanges(patient),
  });

  it('summarises adherence, meals and water over the 30 days only', () => {
    expect(data.summary.adherence).toMatchObject({
      expected: 60,
      given: 58,
      missed: 1,
      notRecorded: 1,
      percent: 97,
    });
    expect(data.summary.meals).toMatchObject({ completed: 30, expected: 90 });
    expect(data.summary.water.averageMl).toBe(1000);
    expect(data.patient).toMatchObject({ age: 78, nurses: ['Anita Sharma'] });
  });

  it('gives per-series vitals stats with the patient ranges', () => {
    const bp = data.charts.find((c) => c.metric.id === 'bp').stats;
    expect(bp.find((s) => s.seriesKey === 'systolic')).toMatchObject({
      count: 30,
      min: 128,
      max: 158,
      outOfRange: 1,
      normal: '90-140',
    });
    const sugar = data.charts.find((c) => c.metric.id === 'sugar').stats;
    // 135 fasting is inside the patient's 80-140 override, so nothing is flagged.
    expect(sugar[0]).toMatchObject({ count: 30, outOfRange: 0, normal: '80-140' });
    // Today's low SpO2 is outside the period.
    expect(data.charts.find((c) => c.metric.id === 'spo2').stats).toEqual([]);
  });

  it('flags weight against a reading from before the period', () => {
    const weight = data.charts.find((c) => c.metric.id === 'weightKg');
    expect(weight.stats[0]).toMatchObject({ count: 1, outOfRange: 1 });
    expect(data.outOfRange.find((r) => r.flag === 'change')).toMatchObject({
      metric: 'Weight',
      note: '-2.5 kg vs 7 days earlier',
    });
  });

  it('lists out-of-range readings, dose problems and concerns in time order', () => {
    expect(data.outOfRange.map((r) => `${r.metric} ${r.value} ${r.flag}`)).toEqual([
      'Weight 57.5 kg change',
      'Blood pressure (Systolic) 158 mmHg high',
      'Blood pressure (Diastolic) 96 mmHg high',
    ]);
    expect(data.doseIssues).toEqual([
      expect.objectContaining({
        dateKey: '2026-11-14',
        scheduledTime: '20:30',
        status: 'not_recorded',
        statusText: 'Not recorded',
      }),
      expect.objectContaining({
        dateKey: '2026-11-17',
        status: 'missed',
        reason: 'Strip finished',
        recordedBy: 'Ravi Kumar',
        medication: 'Metformin 500 mg',
      }),
    ]);
    expect(data.concerns).toEqual([
      {
        at: atIST('2026-11-09', '09:00'),
        text: 'BP high, doctor informed',
        nurseName: 'Anita Sharma',
      },
    ]);
    expect(data.perMedication[0]).toMatchObject({
      given: 58,
      expected: 60,
      times: ['09:00', '20:30'],
    });
  });

  it('builds one condensed log row per day', () => {
    expect(data.daily).toHaveLength(30);
    expect(data.daily.find((d) => d.dateKey === '2026-11-09')).toMatchObject({
      doses: '2/2',
      dosesOk: true,
      meals: 'B All L - D -',
      waterMl: 1000,
      vitals: 1,
      vitalsFlagged: 1,
      concerns: 1,
      notes: 1,
      moodText: '-',
    });
    expect(data.daily.find((d) => d.dateKey === '2026-11-17')).toMatchObject({
      doses: '1/2',
      dosesOk: false,
    });
  });
});
