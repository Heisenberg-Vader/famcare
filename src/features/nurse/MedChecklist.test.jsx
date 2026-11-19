import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MedChecklist } from './MedChecklist.jsx';

const now = new Date('2026-11-19T06:00:00Z');
const dose = (over) => ({
  key: over.key,
  medicationId: 'm',
  medicationName: 'Metformin',
  strength: '500 mg',
  dose: '1 tablet',
  scheduledTime: '09:00',
  status: 'pending',
  entry: null,
  ...over,
});

describe('MedChecklist', () => {
  it('marks a dose with one tap and highlights the current status', () => {
    const onMark = vi.fn();
    const pending = dose({ key: 'a', status: 'not_recorded' });
    const given = dose({
      key: 'b',
      scheduledTime: '20:30',
      status: 'given',
      entry: { id: 'e', status: 'given', nurseId: 'me', createdAt: now, nurseName: 'Anita' },
    });
    render(
      <MedChecklist
        groups={[{ slot: 'Morning', doses: [pending, given] }]}
        uid="me"
        now={now}
        onMark={onMark}
      />,
    );
    expect(screen.getByText('Not recorded')).toBeTruthy();
    const first = screen.getByRole('group', { name: 'Mark Metformin 09:00' });
    fireEvent.click(within(first).getByRole('button', { name: 'Given' }));
    expect(onMark).toHaveBeenCalledWith(pending, 'given');

    const second = screen.getByRole('group', { name: 'Mark Metformin 20:30' });
    const givenButton = within(second).getByRole('button', { name: 'Given' });
    expect(givenButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(givenButton);
    expect(onMark).toHaveBeenCalledTimes(1);
    fireEvent.click(within(second).getByRole('button', { name: 'Refused' }));
    expect(onMark).toHaveBeenLastCalledWith(given, 'refused');
  });

  it("is read-only for another nurse's dose", () => {
    const other = dose({
      key: 'c',
      status: 'missed',
      entry: {
        id: 'x',
        status: 'missed',
        reason: 'Asleep',
        nurseId: 'ravi',
        nurseName: 'Ravi Kumar',
        createdAt: now,
      },
    });
    render(
      <MedChecklist
        groups={[{ slot: 'Night', doses: [other] }]}
        uid="me"
        now={now}
        onMark={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByText('by Ravi Kumar')).toBeTruthy();
    expect(screen.getByText('Asleep')).toBeTruthy();
  });
});
