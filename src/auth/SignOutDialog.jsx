import { useState } from 'react';
import { Button } from '../components/Button.jsx';

/**
 * Replaces the whole app while signing out, so no patient data stays on screen.
 * state.reason 'idle' has no "stay signed in": an unattended device must not be reopened
 * without signing in again.
 */
export function SignOutDialog({ state, onDiscard, onRetry, onCancel, onAcknowledge }) {
  const [confirmed, setConfirmed] = useState(false);
  const idle = state.reason === 'idle';
  const unsyncedText =
    state.count == null
      ? 'Some entries saved on this device have not reached the server.'
      : `${state.count} ${state.count === 1 ? 'entry' : 'entries'} saved on this device ${state.count === 1 ? 'has' : 'have'} not reached the server.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="signout-title" className="text-lg font-semibold text-slate-900">
          {idle ? 'Signed out for inactivity' : 'Signing out'}
        </h2>

        {(state.phase === 'checking' || state.phase === 'discarding') && (
          <p role="status" className="mt-2 text-sm text-slate-600">
            {state.phase === 'checking'
              ? 'Syncing saved entries and clearing data from this device…'
              : 'Clearing data from this device…'}
          </p>
        )}

        {state.phase === 'blocked' && (
          <div className="mt-2 space-y-4 text-sm text-slate-700">
            <p role="alert">{unsyncedText}</p>
            <p>
              {idle
                ? 'Signing out automatically as soon as they sync. Reconnect to the internet, or discard them to sign out now.'
                : 'Reconnect to the internet and try again, or sign out and discard them.'}
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-red-600"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>I understand these entries will be permanently lost.</span>
            </label>
            <div className="flex flex-col gap-2">
              <Button variant="danger" disabled={!confirmed} onClick={onDiscard}>
                Sign out and discard
              </Button>
              <Button variant="secondary" onClick={onRetry}>
                Try syncing again
              </Button>
              {!idle && (
                <Button variant="ghost" onClick={onCancel}>
                  Stay signed in
                </Button>
              )}
            </div>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="mt-2 space-y-4 text-sm text-slate-700">
            <p role="alert">{state.message}</p>
            {state.signedOut ? (
              <Button className="w-full" onClick={onAcknowledge}>
                OK
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button onClick={onRetry}>Try again</Button>
                {!idle && (
                  <Button variant="ghost" onClick={onCancel}>
                    Stay signed in
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
