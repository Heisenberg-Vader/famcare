import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { getDayEntries, watchDayEntries } from '../../data/entries.js';
import { watchMedications } from '../../data/medications.js';
import { watchPatient } from '../../data/patients.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useNow } from '../../hooks/useNow.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { getRanges } from '../../lib/ranges.js';
import { expectedDoses, resolveDoses } from '../../lib/schedule.js';
import { atIST, formatIST, isDateKey, todayKey } from '../../lib/time.js';
import { buildTimeline } from '../../lib/timeline.js';
import { DayNav } from './DayNav.jsx';
import { DayPicker } from './DayPicker.jsx';
import { DaySummaryStrip } from './DaySummaryStrip.jsx';
import { FamilyHeader } from './FamilyHeader.jsx';
import { Timeline } from './Timeline.jsx';
import { useMonthFlags } from './useMonthFlags.js';

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-600">
      <li className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" /> Out-of-range reading
      </li>
      <li className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" /> Missed or
        unrecorded dose
      </li>
    </ul>
  );
}

export function Dashboard() {
  const { patientId } = useParams();
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const today = todayKey(now);
  const requested = params.get('date');
  const dateKey = isDateKey(requested) && requested < today ? requested : today;
  const isToday = dateKey === today;

  const patient = useSubscription((ok, err) => watchPatient(patientId, ok, err), patientId);
  const meds = useSubscription((ok, err) => watchMedications(patientId, ok, err), patientId);
  // Today is always live (also feeds today's calendar dot); past days are read once.
  const live = useSubscription(
    (ok, err) => watchDayEntries(patientId, today, ok, err),
    `${patientId}|${today}`,
  );
  const past = useAsync(
    () => getDayEntries(patientId, dateKey),
    isToday ? null : `${patientId}|${dateKey}`,
  );
  const day = isToday ? live : past;

  const [calendarOpen, setCalendarOpen] = useState(true);
  const [month, setMonth] = useState(null);
  const visibleMonth = month ?? atIST(dateKey, '12:00');
  const medications = useMemo(() => meds.data ?? [], [meds.data]);
  const { flags } = useMonthFlags({
    patient: calendarOpen ? patient.data : null,
    medications,
    monthKey: formatIST(visibleMonth, 'yyyy-MM'),
    today,
    todayEntries: live.data,
    now,
  });

  const entries = useMemo(() => day.data ?? [], [day.data]);
  const ranges = useMemo(() => getRanges(patient.data), [patient.data]);
  const doses = useMemo(
    () => resolveDoses(expectedDoses(medications, dateKey), entries, now),
    [medications, dateKey, entries, now],
  );
  const timeline = useMemo(
    () => buildTimeline({ entries, doses, ranges }),
    [entries, doses, ranges],
  );

  if (patient.loading) return <Spinner label="Loading" />;
  if (patient.error) return <ErrorState error={patient.error} />;
  if (!patient.data) return <EmptyState title="Patient not found" />;

  function changeDate(next) {
    setMonth(null);
    setParams(next >= today ? {} : { date: next });
  }

  return (
    <div className="space-y-4">
      <FamilyHeader patient={patient.data} />

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
        <DayNav
          dateKey={dateKey}
          today={today}
          onChange={changeDate}
          calendarOpen={calendarOpen}
          onToggleCalendar={() => setCalendarOpen((o) => !o)}
        />
        {calendarOpen && (
          <div className="flex flex-col items-center">
            <DayPicker
              dateKey={dateKey}
              today={today}
              month={visibleMonth}
              onMonthChange={setMonth}
              onSelect={changeDate}
              flags={flags}
            />
            <Legend />
          </div>
        )}
      </div>

      {day.loading || meds.loading ? (
        <Spinner label="Loading the day" />
      ) : day.error ? (
        <ErrorState error={day.error} />
      ) : (
        <>
          <DaySummaryStrip
            entries={entries}
            medications={medications}
            dateKey={dateKey}
            now={now}
          />
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-slate-800">Timeline</h2>
            {isToday && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                Live
              </span>
            )}
          </div>
          {timeline.length === 0 ? (
            <EmptyState title="Nothing logged this day" />
          ) : (
            <Timeline items={timeline} />
          )}
        </>
      )}
    </div>
  );
}
