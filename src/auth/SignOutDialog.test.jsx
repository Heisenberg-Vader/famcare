import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SignOutDialog } from './SignOutDialog.jsx';

const handlers = () => ({
  onDiscard: vi.fn(),
  onRetry: vi.fn(),
  onCancel: vi.fn(),
  onAcknowledge: vi.fn(),
});

describe('SignOutDialog', () => {
  it('shows the unsynced count and needs confirmation before discarding', () => {
    const h = handlers();
    render(<SignOutDialog state={{ reason: 'manual', phase: 'blocked', count: 3 }} {...h} />);
    expect(screen.getByRole('alert').textContent).toMatch(/3 entries/);
    const discard = screen.getByRole('button', { name: 'Sign out and discard' });
    expect(discard.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(discard);
    expect(h.onDiscard).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(h.onCancel).toHaveBeenCalled();
  });

  it('offers no way back into the app after an idle sign-out', () => {
    render(
      <SignOutDialog state={{ reason: 'idle', phase: 'blocked', count: 1 }} {...handlers()} />,
    );
    expect(screen.getByText('Signed out for inactivity')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stay signed in' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/1 entry/);
  });
});
