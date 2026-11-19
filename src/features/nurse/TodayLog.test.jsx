import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, signedInAs } from '../../test/renderWithProviders.jsx';
import { todayKey, atIST } from '../../lib/time.js';

// Midday IST, so every fixture time is safely in the past and the 23:59 dose is pending.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-11-19T06:30:00Z'));
const today = todayKey();

vi.mock('../../data/patients.js', () => ({
  watchPatient: (id, ok) => {
    ok({
      id,
      fullName: 'Kamla Devi',
      dob: '1948-03-14',
      city: 'Jaipur',
      conditions: ['Hypertension'],
    });
    return () => {};
  },
}));
vi.mock('../../data/medications.js', () => ({
  watchMedications: (id, ok) => {
    ok([
      {
        id: 'aml',
        name: 'Amlodipine',
        strength: '5 mg',
        dose: '1 tablet',
        times: ['23:59'],
        startDate: '2020-01-01',
        active: true,
      },
    ]);
    return () => {};
  },
}));
const entriesFixture = [];
vi.mock('../../data/entries.js', () => ({
  watchNurseEntries: (id, ok) => {
    ok(entriesFixture);
    return () => {};
  },
  createEntry: vi.fn(() => 'new-id'),
  updateEntry: vi.fn(),
}));

const { createEntry, updateEntry } = await import('../../data/entries.js');
const { TodayLog } = await import('./TodayLog.jsx');

function renderLog() {
  return renderWithProviders(
    <Routes>
      <Route path="/nurse/patients/:patientId" element={<TodayLog />} />
    </Routes>,
    { auth: signedInAs('nurse'), route: '/nurse/patients/p1' },
  );
}

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
  entriesFixture.length = 0;
});

describe('TodayLog', () => {
  it('shows the patient and logs 250 ml of water with one tap', () => {
    renderLog();
    expect(screen.getByRole('heading', { name: 'Kamla Devi' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Water \+250 ml/ }));
    expect(createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1', type: 'water', payload: { ml: 250 } }),
    );
    expect(createEntry.mock.calls[0][0].nurse).toEqual({ uid: 'u-nurse', name: 'Anita Sharma' });
    expect(screen.getByRole('status', { name: '' }).textContent).toMatch(/Saved/);
  });

  it('marks a dose given in one tap and asks for a reason when refused', () => {
    renderLog();
    const group = screen.getByRole('group', { name: 'Mark Amlodipine 23:59' });
    fireEvent.click(within(group).getByRole('button', { name: 'Given' }));
    expect(createEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'medication',
        payload: expect.objectContaining({
          medicationId: 'aml',
          scheduledTime: '23:59',
          status: 'given',
        }),
      }),
    );

    fireEvent.click(within(group).getByRole('button', { name: 'Refused' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark refused' }));
    expect(within(dialog).getByText('Give a reason')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Spat it out' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark refused' }));
    expect(createEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ status: 'refused', reason: 'Spat it out' }),
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a quick-add form and saves it', () => {
    renderLog();
    fireEvent.click(screen.getByRole('button', { name: /Note/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add note' });
    fireEvent.change(within(dialog).getByLabelText('Observation'), {
      target: { value: 'Ate well' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(createEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'observation',
        payload: { text: 'Ate well', severity: 'info' },
      }),
    );
  });

  it('edits own entries from the list, and only those', () => {
    entriesFixture.push(
      {
        id: 'w1',
        type: 'water',
        ml: 200,
        dateKey: today,
        at: atIST(today, '00:01'),
        nurseId: 'u-nurse',
        nurseName: 'Anita Sharma',
        createdAt: new Date(),
      },
      {
        id: 'w2',
        type: 'water',
        ml: 300,
        dateKey: today,
        at: atIST(today, '00:02'),
        nurseId: 'other',
        nurseName: 'Ravi Kumar',
        createdAt: new Date(),
      },
    );
    renderLog();
    const editable = screen.getAllByRole('button', { name: /Water 200 ml/ });
    expect(editable).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Water 300 ml/ })).toBeNull();
    fireEvent.click(editable[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit water' });
    fireEvent.click(within(dialog).getByRole('button', { name: '150 ml' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(updateEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: expect.objectContaining({ id: 'w1' }),
        payload: { ml: 150 },
      }),
    );
  });
});
