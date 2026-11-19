import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { watchDayEntries } from '../../data/entries.js';
import { watchMedications } from '../../data/medications.js';
import { watchPatient } from '../../data/patients.js';
import { useNow } from '../../hooks/useNow.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { isDateKey, todayKey } from '../../lib/time.js';
import { DayView } from './DayView.jsx';
import { FamilyHeader } from './FamilyHeader.jsx';
import { VitalsCharts } from './VitalsCharts.jsx';
import { WeeklySummary } from './WeeklySummary.jsx';

const TABS = [
  { id: 'day', label: 'Day' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'summary', label: 'Summary' },
];

export function Dashboard() {
  const { patientId } = useParams();
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const today = todayKey(now);
  const requested = params.get('date');
  const dateKey = isDateKey(requested) && requested < today ? requested : today;
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'day';

  const patient = useSubscription((ok, err) => watchPatient(patientId, ok, err), patientId);
  const meds = useSubscription((ok, err) => watchMedications(patientId, ok, err), patientId);
  // Today is always live: feeds the day timeline, today's calendar dot, charts and summary.
  const live = useSubscription(
    (ok, err) => watchDayEntries(patientId, today, ok, err),
    `${patientId}|${today}`,
  );
  const medications = useMemo(() => meds.data ?? [], [meds.data]);

  if (patient.loading || meds.loading) return <Spinner label="Loading" />;
  if (patient.error) return <ErrorState error={patient.error} />;
  if (!patient.data) return <EmptyState title="Patient not found" />;

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  }

  const shared = { patient: patient.data, medications, live, today, now };

  return (
    <div className="space-y-4">
      <FamilyHeader patient={patient.data} />
      {meds.error && <ErrorState error={meds.error} />}

      <div
        role="tablist"
        aria-label="Views"
        className="grid grid-cols-3 rounded-lg bg-slate-200 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => update({ tab: t.id === 'day' ? null : t.id })}
            className={`min-h-10 rounded-md text-sm font-medium ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'day' && (
          <DayView
            {...shared}
            dateKey={dateKey}
            onChangeDate={(next) => update({ date: next >= today ? null : next })}
          />
        )}
        {tab === 'vitals' && <VitalsCharts {...shared} />}
        {tab === 'summary' && <WeeklySummary {...shared} />}
      </div>
    </div>
  );
}
