import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { App } from './App.jsx';

vi.mock('./data/patients.js', () => ({
  watchMyPatients: (uid, role, ok) => {
    ok([
      { id: 'a', fullName: 'Patient A' },
      { id: 'b', fullName: 'Patient B' },
    ]);
    return () => {};
  },
}));

import { fakeAuth, renderWithProviders, signedInAs } from './test/renderWithProviders.jsx';

describe('App routing', () => {
  it('sends signed-out users from / to the login page', () => {
    renderWithProviders(<App />, { route: '/' });
    expect(screen.getByRole('heading', { name: 'CarePal Daily Care' })).toBeTruthy();
  });

  it('sends a signed-in nurse from / to the nurse home', () => {
    renderWithProviders(<App />, { route: '/', auth: signedInAs('nurse') });
    expect(screen.getByRole('heading', { name: 'My patients' })).toBeTruthy();
  });

  it('sends a signed-in family member from / to the family home', () => {
    renderWithProviders(<App />, { route: '/', auth: signedInAs('family') });
    expect(screen.getByRole('heading', { name: 'Family dashboard' })).toBeTruthy();
  });

  it('shows a loader while auth is resolving', () => {
    renderWithProviders(<App />, { route: '/', auth: fakeAuth({ status: 'loading' }) });
    expect(screen.getByRole('status').textContent).toMatch(/Checking your account/);
  });

  it('shows not found for unknown paths', () => {
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
