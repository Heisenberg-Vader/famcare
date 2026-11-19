import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, homePathFor, pathAllowedFor } from '../auth/roles.js';
import { Button } from '../components/Button.jsx';
import { Card } from '../components/Card.jsx';
import { FullScreenLoader } from '../components/FullScreenLoader.jsx';

const inputClass =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none';

export function Login() {
  const { status, role, error: authError, signIn, signOut } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading') return <FullScreenLoader label="Checking your account" />;

  if (status === 'signedIn') {
    const from = location.state?.from;
    return <Navigate to={pathAllowedFor(role, from) ? from : homePathFor(role)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      // Redirect happens when the auth state updates.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(kind) {
    setEmail(DEMO_ACCOUNTS[kind].email);
    setPassword(DEMO_PASSWORD);
    setError('');
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-brand-700">CarePal Daily Care</h1>
        <p className="mt-1 text-sm text-slate-600">Daily care logs for nurses and families</p>
      </div>

      {status === 'noRole' ? (
        <Card className="space-y-3">
          <p role="alert" className="text-sm text-red-700">
            {authError?.message ??
              'This account is not set up as a nurse or family member. Contact your care coordinator.'}
          </p>
          <Button variant="secondary" className="w-full" onClick={() => signOut().catch(() => {})}>
            Sign out
          </Button>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                inputMode="email"
                autoComplete="username"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-2 text-center text-xs text-slate-500">
              Demo accounts (synthetic data)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DEMO_ACCOUNTS).map(([kind, account]) => (
                <Button
                  key={kind}
                  variant="secondary"
                  onClick={() => fillDemo(kind)}
                  disabled={busy}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </main>
  );
}
