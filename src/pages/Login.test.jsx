import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { Login } from './Login.jsx';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../auth/roles.js';
import { UserFacingError } from '../data/errors.js';
import { fakeAuth, renderWithProviders, signedInAs } from '../test/renderWithProviders.jsx';

function renderLogin(auth, state) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/nurse/*" element={<p>nurse home</p>} />
      <Route path="/family/*" element={<p>family home</p>} />
    </Routes>,
    { auth, route: '/login', state },
  );
}

const emailInput = () => screen.getByLabelText('Email');
const passwordInput = () => screen.getByLabelText('Password');

describe('Login', () => {
  it('fills demo credentials and submits them', async () => {
    const auth = fakeAuth();
    renderLogin(auth);
    fireEvent.click(screen.getByRole('button', { name: 'Use demo family' }));
    expect(emailInput().value).toBe(DEMO_ACCOUNTS.family.email);
    expect(passwordInput().value).toBe(DEMO_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Use demo nurse' }));
    expect(emailInput().value).toBe(DEMO_ACCOUNTS.nurse.email);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(auth.signIn).toHaveBeenCalledWith(DEMO_ACCOUNTS.nurse.email, DEMO_PASSWORD),
    );
  });

  it('validates empty fields without calling sign in', () => {
    const auth = fakeAuth();
    renderLogin(auth);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Enter your email and password/);
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('shows the user-facing error when sign in fails', async () => {
    const auth = fakeAuth();
    auth.signIn.mockRejectedValue(new UserFacingError('Email or password is incorrect.'));
    renderLogin(auth);
    fireEvent.change(emailInput(), { target: { value: 'a@b.test' } });
    fireEvent.change(passwordInput(), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect.');
  });

  it('redirects a signed-in user by role', () => {
    renderLogin(signedInAs('family'));
    expect(screen.getByText('family home')).toBeTruthy();
  });

  it('honours the original destination only within the role area', () => {
    renderLogin(signedInAs('nurse'), { from: '/family/x' });
    expect(screen.getByText('nurse home')).toBeTruthy();
  });

  it('explains accounts without a role and offers sign out', () => {
    const auth = fakeAuth({ status: 'noRole', user: { uid: 'x' } });
    renderLogin(auth);
    expect(screen.getByRole('alert').textContent).toMatch(/not set up/);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
  });
});
