import { Link } from 'react-router-dom';
import { PatientSummary } from '../../components/PatientSummary.jsx';
import { dayProgress } from '../../lib/summaries.js';
import { useTodayData } from './useTodayData.js';

function Chip({ tone, children }) {
  const tones = {
    good: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-amber-100 text-amber-800',
    bad: 'bg-red-100 text-red-800',
    muted: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PatientCard({ patient, now }) {
  const { today, medications, todayEntries, loading } = useTodayData(patient.id, now);
  const p = dayProgress({ entries: todayEntries, medications, dateKey: today, now });

  return (
    <Link
      to={`/nurse/patients/${patient.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500"
    >
      <PatientSummary patient={patient} as="h2" />
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Today's progress">
        {loading ? (
          <Chip tone="muted">Loading today…</Chip>
        ) : (
          <>
            <Chip tone={p.vitalsCount > 0 ? 'good' : 'muted'}>
              {p.vitalsCount > 0 ? `Vitals done (${p.vitalsCount})` : 'Vitals not done'}
            </Chip>
            <Chip tone={p.dosesGiven === p.dosesScheduled ? 'good' : 'muted'}>
              Doses given {p.dosesGiven}/{p.dosesScheduled}
            </Chip>
            {p.dosesNotRecorded > 0 && <Chip tone="bad">{p.dosesNotRecorded} not recorded</Chip>}
            {p.dosesNotGiven > 0 && <Chip tone="warn">{p.dosesNotGiven} missed/refused</Chip>}
          </>
        )}
      </div>
    </Link>
  );
}
