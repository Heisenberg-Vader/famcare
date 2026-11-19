import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VitalsForm } from './VitalsForm.jsx';
import { todayKey } from '../../../lib/time.js';

const today = todayKey();
const fill = (name, value) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${name}`)), { target: { value } });

describe('VitalsForm', () => {
  it('requires at least one reading', () => {
    const onSave = vi.fn();
    render(<VitalsForm dateKey={today} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toMatch(/at least one/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves numbers with the sugar context', () => {
    const onSave = vi.fn();
    render(<VitalsForm dateKey={today} onSave={onSave} onCancel={vi.fn()} />);
    fill('Systolic', '132');
    fill('Diastolic', '84');
    fill('Blood sugar', '118');
    fireEvent.click(screen.getByRole('button', { name: 'Fasting' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [payload, at] = onSave.mock.calls[0];
    expect(payload).toEqual({ systolic: 132, diastolic: 84, sugar: 118, sugarContext: 'fasting' });
    expect(at).toBeInstanceOf(Date);
  });

  it('rejects a time in the future', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T04:30:00Z')); // 10:00 IST
    try {
      const onSave = vi.fn();
      render(<VitalsForm dateKey="2026-11-19" onSave={onSave} onCancel={vi.fn()} />);
      fill('Pulse', '80');
      fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: '10:30' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Time cannot be in the future')).toBeTruthy();
      expect(onSave).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(/^Time/), { target: { value: '09:15' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSave.mock.calls[0][1].toISOString()).toBe('2026-11-19T03:45:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });
});
