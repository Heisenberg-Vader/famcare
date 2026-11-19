import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { atIST, lastNDays } from '../../lib/time.js';

const TODAY = '2026-11-19';
const NOW = atIST(TODAY, '15:00');
const meds = [
  {
    id: 'm',
    name: 'Metformin',
    strength: '500 mg',
    times: ['09:00'],
    startDate: '2026-01-01',
    active: true,
  },
];

// 14 full days before today: doses given except two missed in the last week and one
// unrecorded in the week before; 2 main meals completed per day; mood 4 then 3.
function fixtures() {
  const entries = [];
  lastNDays('2026-11-18', 14).forEach((k, i) => {
    const recent = i >= 7;
    if (!(recent && (i === 10 || i === 12)) && i !== 3) {
      entries.push({
        type: 'medication',
        medicationId: 'm',
        dateKey: k,
        scheduledTime: '09:00',
        status: 'given',
        at: atIST(k, '09:05'),
      });
    }
    if (recent && (i === 10 || i === 12)) {
      entries.push({
        type: 'medication',
        medicationId: 'm',
        dateKey: k,
        scheduledTime: '09:00',
        status: 'missed',
        reason: 'x',
        at: atIST(k, '10:00'),
      });
    }
    entries.push({
      type: 'meal',
      slot: 'breakfast',
      portion: 1,
      dateKey: k,
      at: atIST(k, '08:30'),
    });
    entries.push({ type: 'meal', slot: 'lunch', portion: 0.75, dateKey: k, at: atIST(k, '13:00') });
    entries.push({ type: 'meal', slot: 'dinner', portion: 0.5, dateKey: k, at: atIST(k, '20:00') });
    entries.push({
      type: 'activity',
      kind: 'walk',
      durationMin: recent ? 30 : 20,
      dateKey: k,
      at: atIST(k, '07:30'),
    });
    entries.push({
      type: 'mood',
      score: recent ? 3 : 4,
      tags: [],
      dateKey: k,
      at: atIST(k, '10:30'),
    });
    entries.push({ type: 'water', ml: recent ? 1500 : 1200, dateKey: k, at: atIST(k, '12:00') });
    entries.push({
      type: 'vitals',
      systolic: i === 12 ? 160 : 128,
      diastolic: 82,
      pulse: 76,
      dateKey: k,
      at: atIST(k, '08:15'),
    });
  });
  return entries;
}

vi.mock('../../data/entries.js', () => ({
  getEntriesBetween: vi.fn(async () => fixtures()),
  getVitalsSince: vi.fn(async () => fixtures().filter((e) => e.type === 'vitals')),
}));

const data = await import('../../data/entries.js');
const { WeeklySummary } = await import('./WeeklySummary.jsx');
const { VitalsCharts } = await import('./VitalsCharts.jsx');

const patient = { id: 'p1', fullName: 'Kamla Devi' };

describe('WeeklySummary', () => {
  it('summarises the last 7 full days against the 7 before', async () => {
    render(<WeeklySummary patient={patient} medications={meds} today={TODAY} now={NOW} />);
    expect(await screen.findByText('71%')).toBeTruthy(); // 5 of 7 given
    expect(data.getEntriesBetween).toHaveBeenCalledWith('p1', '2026-11-05', '2026-11-18');
    expect(screen.getByText('5 of 7 due doses given')).toBeTruthy();
    expect(screen.getByText(/0 not recorded · 2\s+missed, refused or held/)).toBeTruthy();
    // previous week: 6 of 7 given = 86% -> -15 pts
    expect(screen.getByText(/-15 pts vs previous 7 days/)).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy(); // 14 of 21 main meals
    expect(screen.getByText('210 min')).toBeTruthy();
    expect(screen.getByText(/\+70 min vs previous 7 days/)).toBeTruthy();
    expect(screen.getByLabelText('trend down')).toBeTruthy();
    expect(screen.getByText('1500 ml/day')).toBeTruthy();
    expect(screen.getByText('12 Nov – 18 Nov', { exact: false })).toBeTruthy();
  });
});

describe('VitalsCharts', () => {
  it('shows a chart per metric with out-of-range counts and a 7D/30D toggle', async () => {
    const live = {
      data: [{ type: 'vitals', id: 'live', pulse: 120, dateKey: TODAY, at: atIST(TODAY, '14:00') }],
    };
    render(<VitalsCharts patient={patient} live={live} today={TODAY} />);
    expect(await screen.findByRole('heading', { name: 'Blood pressure' })).toBeTruthy();
    expect(screen.getByText('Normal 90–140 / 60–90 mmHg')).toBeTruthy();
    expect(screen.getByText(/1 of 12 readings out of range/)).toBeTruthy(); // BP, 6 days in 7D window
    // The live pulse reading (120, high) is included immediately.
    expect(screen.getByText(/1 of 7 readings out of range/)).toBeTruthy();
    expect(screen.getByText('Reference ranges, configurable; not clinical advice.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '30D' }));
    expect(screen.getByRole('button', { name: '30D' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/1 of 28 readings out of range/)).toBeTruthy(); // BP, all 14 days
  });
});
