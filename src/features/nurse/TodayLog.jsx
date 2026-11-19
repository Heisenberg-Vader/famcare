import { Icon } from '../../components/Icon.jsx';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/authContext.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { PatientSummary } from '../../components/PatientSummary.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { watchPatient } from '../../data/patients.js';
import { useNow } from '../../hooks/useNow.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { canEditEntry } from '../../lib/entries.js';
import { getRanges } from '../../lib/ranges.js';
import { expectedDoses, groupBySlot, resolveDoses } from '../../lib/schedule.js';
import { formatDateKey } from '../../lib/time.js';
import { buildTimeline } from '../../lib/timeline.js';
import { Timeline } from '../family/Timeline.jsx';
import { DoseReasonSheet } from './DoseReasonSheet.jsx';
import { EntrySheet } from './EntrySheet.jsx';
import { MedChecklist } from './MedChecklist.jsx';
import { QuickAdd } from './QuickAdd.jsx';
import { useEntryActions } from './useEntryActions.js';
import { useTodayData } from './useTodayData.js';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

export function TodayLog() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const now = useNow();
  const patient = useSubscription((ok, err) => watchPatient(patientId, ok, err), patientId);
  const { today, medications, todayEntries, loading, error } = useTodayData(patientId, now);
  const actions = useEntryActions(patientId);
  const [sheet, setSheet] = useState(null); // { kind: 'entry', type, entry } | { kind: 'dose', dose, status }
  const close = useCallback(() => setSheet(null), []);

  const doses = useMemo(
    () => resolveDoses(expectedDoses(medications, today), todayEntries, now),
    [medications, today, todayEntries, now],
  );
  const ranges = useMemo(() => getRanges(patient.data), [patient.data]);
  const timeline = useMemo(
    () => buildTimeline({ entries: todayEntries, doses, ranges }),
    [todayEntries, doses, ranges],
  );

  if (patient.loading) return <Spinner label="Loading patient" />;
  if (patient.error) return <ErrorState error={patient.error} />;
  if (!patient.data) return <EmptyState title="Patient not found" />;

  function markDose(dose, status) {
    if (status !== 'given') {
      setSheet({ kind: 'dose', dose, status });
      return;
    }
    saveDose(dose, 'given');
  }

  function saveDose(dose, status, reason) {
    const payload = {
      medicationId: dose.medicationId,
      medicationName: dose.medicationName,
      scheduledTime: dose.scheduledTime,
      status,
      reason,
    };
    const ok = dose.entry
      ? actions.update(dose.entry, payload, new Date())
      : actions.create('medication', payload, new Date());
    if (ok) close();
  }

  function saveEntry(payload, at) {
    const ok = sheet.entry
      ? actions.update(sheet.entry, payload, at)
      : actions.create(sheet.type, payload, at);
    if (ok) close();
  }

  // Doses are changed from the checklist; other own entries open their form.
  const canSelect = (entry) => entry.type !== 'medication' && canEditEntry(entry, user.uid, now);

  function selectTimelineItem(item) {
    setSheet({ kind: 'entry', type: item.entry.type, entry: item.entry });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/nurse"
          className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-700"
        >
          <Icon name="chevron-left" size={16} strokeWidth={2.25} />
          My patients
        </Link>
        <div className="mt-2">
          <PatientSummary patient={patient.data} />
        </div>
        <p className="mt-1 text-sm text-slate-500">Today, {formatDateKey(today, 'EEE d MMM')}</p>
      </div>

      {error && <ErrorState error={error} />}

      <Section title="Quick add">
        <QuickAdd
          onAdd={(type) => setSheet({ kind: 'entry', type, entry: null })}
          onQuickWater={() => actions.create('water', { ml: 250 }, new Date())}
        />
      </Section>

      <Section title="Medicines">
        {loading ? (
          <Spinner label="Loading medicines" />
        ) : (
          <MedChecklist groups={groupBySlot(doses)} uid={user.uid} now={now} onMark={markDose} />
        )}
      </Section>

      <Section title="Today's entries">
        {loading ? (
          <Spinner label="Loading entries" />
        ) : timeline.length === 0 ? (
          <EmptyState title="Nothing logged yet today">
            Use Quick add to log the first entry.
          </EmptyState>
        ) : (
          <Timeline
            items={[...timeline].reverse()}
            canSelect={canSelect}
            onSelect={selectTimelineItem}
          />
        )}
      </Section>

      {sheet?.kind === 'entry' && (
        <EntrySheet
          type={sheet.type}
          entry={sheet.entry}
          dateKey={today}
          onSave={saveEntry}
          onClose={close}
        />
      )}
      {sheet?.kind === 'dose' && (
        <DoseReasonSheet
          dose={sheet.dose}
          status={sheet.status}
          onSave={(reason) => saveDose(sheet.dose, sheet.status, reason)}
          onClose={close}
        />
      )}
    </div>
  );
}
