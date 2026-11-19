import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders, signedInAs } from '../../test/renderWithProviders.jsx';
import { atIST } from '../../lib/time.js';

// The app clock is pinned to 15:00 IST on 19 Nov 2026 through useNow. Date itself is not
// faked: react-day-picker's TZDate extends Date and breaks under a faked Date class.
vi.mock('../../hooks/useNow.js', () => ({ useNow: () => new Date('2026-11-19T09:30:00Z') }));
const TODAY = '2026-11-19';
const YESTERDAY = '2026-11-18';

const liveListeners = [];
vi.mock('../../data/patients.js', () => ({
  watchPatient: (id, ok) => {
    ok({
      id,
      fullName: 'Kamla Devi',
      dob: '1948-03-14',
      conditions: ['Type 2 diabetes'],
      nurses: [{ id: 'n', fullName: 'Anita Sharma', shift: 'Day (08:00 to 20:00)' }],
      primaryDoctor: 'Dr. Meera Agarwal',
    });
    return () => {};
  },
}));
vi.mock('../../data/medications.js', () => ({
  watchMedications: (id, ok) => {
    ok([
      {
        id: 'met',
        name: 'Metformin',
        strength: '500 mg',
        times: ['09:00'],
        startDate: '2026-01-01',
        active: true,
      },
    ]);
    return () => {};
  },
}));
vi.mock('../../data/entries.js', () => ({
  watchDayEntries: vi.fn((pid, dateKey, ok) => {
    liveListeners.push(ok);
    ok([]);
    return () => {};
  }),
  getDayEntries: vi.fn(async () => [
    {
      id: 'v',
      type: 'vitals',
      dateKey: '2026-11-18',
      at: new Date('2026-11-18T03:00:00Z'),
      systolic: 162,
      diastolic: 96,
      nurseName: 'Anita Sharma',
    },
  ]),
  getEntriesBetween: vi.fn(async () => [
    {
      id: 'v',
      type: 'vitals',
      dateKey: '2026-11-18',
      at: new Date('2026-11-18T03:00:00Z'),
      systolic: 162,
      diastolic: 96,
    },
    {
      id: 'g',
      type: 'medication',
      dateKey: '2026-11-18',
      medicationId: 'met',
      scheduledTime: '09:00',
      status: 'given',
      at: new Date('2026-11-18T03:40:00Z'),
    },
  ]),
}));

const entries = await import('../../data/entries.js');
const { Dashboard } = await import('./Dashboard.jsx');

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.search}</p>;
}

function renderDashboard(search = '') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/family/patients/:patientId"
        element={
          <>
            <Dashboard />
            <Where />
          </>
        }
      />
    </Routes>,
    { auth: signedInAs('family'), route: `/family/patients/p1${search}` },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  liveListeners.length = 0;
});

describe('family Dashboard', () => {
  it('shows the header and a live today timeline that updates when the nurse logs', async () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Kamla Devi' })).toBeTruthy();
    expect(screen.getByText(/Anita Sharma \(Day\)/)).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(entries.watchDayEntries).toHaveBeenCalledWith(
      'p1',
      TODAY,
      expect.any(Function),
      expect.any(Function),
    );
    expect(entries.getDayEntries).not.toHaveBeenCalled();
    // 09:00 dose with no entry by 15:00 -> not recorded.
    expect(screen.getByText(/Metformin 500 mg \(09:00\): not recorded/)).toBeTruthy();

    act(() =>
      liveListeners.at(-1)([
        {
          id: 'w',
          type: 'water',
          ml: 250,
          dateKey: TODAY,
          at: atIST(TODAY, '14:55'),
          nurseName: 'Anita Sharma',
        },
      ]),
    );
    expect(screen.getByText('Water 250 ml')).toBeTruthy();
  });

  it('loads past days once, with out-of-range values in red, and returns to today', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(screen.getByTestId('where').textContent).toBe(`?date=${YESTERDAY}`);
    expect(await screen.findByText(/BP 162\/96/)).toBeTruthy();
    expect(entries.getDayEntries).toHaveBeenCalledWith('p1', YESTERDAY);
    expect(screen.getByText(/BP 162\/96/).className).toMatch(/text-red-700/);
    expect(screen.queryByText('Live')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('where').textContent).toBe('');
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('marks flagged days on the calendar and selects a day', async () => {
    renderDashboard();
    const flagged = await screen.findByRole('button', {
      name: /18 November 2026, out-of-range reading/,
    });
    // Today's 09:00 dose is not recorded -> amber dot on today.
    expect(
      screen.getByRole('button', { name: /19 November 2026, missed or unrecorded dose/ }),
    ).toBeTruthy();
    expect(entries.getEntriesBetween).toHaveBeenCalledWith('p1', '2026-11-01', TODAY);
    fireEvent.click(flagged);
    expect(screen.getByTestId('where').textContent).toBe(`?date=${YESTERDAY}`);
    const next = screen.getByRole('button', { name: /20 November 2026/ });
    expect(next.disabled).toBe(true);
    expect(within(screen.getByRole('grid')).getAllByRole('button').length).toBeGreaterThan(27);
  });

  it('ignores future or invalid dates in the URL', () => {
    renderDashboard('?date=2030-01-01');
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next day' }).disabled).toBe(true);
  });
});
