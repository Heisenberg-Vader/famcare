import { useAuth } from '../auth/authContext.js';
import { Button } from './Button.jsx';

const ROLE_LABEL = { nurse: 'Nurse', family: 'Family' };

export function AppHeader() {
  const { user, role, profile, signOut } = useAuth();
  const name = profile?.fullName ?? user?.displayName ?? user?.email;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-2 sm:max-w-2xl">
        <span className="text-lg font-semibold text-brand-700">CarePal</span>
        <div className="ml-auto min-w-0 text-right leading-tight">
          <p className="truncate text-sm font-medium text-slate-800">{name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[role]}</p>
        </div>
        <Button variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
