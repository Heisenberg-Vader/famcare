import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../auth/authContext.js';
import { ToastProvider } from '../components/ToastProvider.jsx';

export function fakeAuth(overrides = {}) {
  return {
    status: 'signedOut',
    user: null,
    role: null,
    profile: null,
    error: null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export const signedInAs = (role, overrides = {}) =>
  fakeAuth({
    status: 'signedIn',
    role,
    user: { uid: `u-${role}`, email: `${role}@example.test` },
    profile: { fullName: role === 'nurse' ? 'Anita Sharma' : 'Priya Sharma' },
    ...overrides,
  });

/** Renders with router, toasts and a fake auth value (never touches Firebase). */
export function renderWithProviders(ui, { auth = fakeAuth(), route = '/', state } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: route, state }]}>
      <ToastProvider>
        <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
