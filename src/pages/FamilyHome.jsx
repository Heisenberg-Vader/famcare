import { AppHeader } from '../components/AppHeader.jsx';
import { PageShell } from '../components/PageShell.jsx';

export function FamilyHome() {
  return (
    <>
      <AppHeader />
      <PageShell title="Family dashboard">
        <p className="text-slate-600">The day timeline arrives in phase 5.</p>
      </PageShell>
    </>
  );
}
