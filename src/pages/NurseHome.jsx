import { AppHeader } from '../components/AppHeader.jsx';
import { PageShell } from '../components/PageShell.jsx';

export function NurseHome() {
  return (
    <>
      <AppHeader />
      <PageShell title="My patients">
        <p className="text-slate-600">Patient list and today&apos;s log arrive in phase 4.</p>
      </PageShell>
    </>
  );
}
