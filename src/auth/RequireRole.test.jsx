import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { RequireRole } from './RequireRole.jsx';
import { fakeAuth, renderWithProviders, signedInAs } from '../test/renderWithProviders.jsx';

function Where() {
  const location = useLocation();
  return (
    <p data-testid="where">
      {location.pathname}|{location.state?.from ?? ''}
    </p>
  );
}

function renderGuarded(auth, route = '/nurse/patients/p1') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/nurse/*"
        element={
          <RequireRole role="nurse">
            <p>nurse area</p>
          </RequireRole>
        }
      />
      <Route path="*" element={<Where />} />
    </Routes>,
    { auth, route },
  );
}

describe('RequireRole', () => {
  it('renders children for the matching role', () => {
    renderGuarded(signedInAs('nurse'));
    expect(screen.getByText('nurse area')).toBeTruthy();
  });

  it('redirects signed-out users to login and remembers where they were going', () => {
    renderGuarded(fakeAuth());
    expect(screen.getByTestId('where').textContent).toBe('/login|/nurse/patients/p1');
  });

  it('sends a user with another role to their own home', () => {
    renderGuarded(signedInAs('family'));
    expect(screen.getByTestId('where').textContent).toBe('/family|');
  });

  it('treats accounts without a role as signed out', () => {
    renderGuarded(fakeAuth({ status: 'noRole', user: { uid: 'x' } }));
    expect(screen.getByTestId('where').textContent).toMatch(/^\/login\|/);
  });

  it('waits while auth is loading', () => {
    renderGuarded(fakeAuth({ status: 'loading' }));
    expect(screen.queryByText('nurse area')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
