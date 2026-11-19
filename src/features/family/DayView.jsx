import { useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { getDayEntries } from '../../data/entries.js';
import { useAsync } from '../../hooks/useAsync.js';
import { getRanges } from '../../lib/ranges.js';
import { expectedDoses, resolveDoses } from '../../lib/schedule.js';
import { atIST, formatIST } from '../../lib/time.js';
import { buildTimeline } from '../../lib/timeline.js';
import { DayNav } from './DayNav.jsx';
import { DayPicker } from './DayPicker.jsx';
import { DaySummaryStrip } from './DaySummaryStrip.jsx';
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

/** One day: calendar, navigation, summary strip and timeline. Today comes from `live`. */
export function DayView({ patient, medications, live, dateKey, today, now, onChangeDate }) {
  const isToday = dateKey === today;
  const past = useAsync(
    () => getDayEntries(patient.id, dateKey),
    isToday ? null : `${patient.id}|${dateKey}`,
  );
  const day = isToday ? live : past;

  const [calendarOpen, setCalendarOpen] = useState(true);
  const [month, setMonth] = useState(null);
  const visibleMonth = month ?? atIST(dateKey, '12:00');
  const { flags } = useMonthFlags({
    patient: calendarOpen ? patient : null,
    medications,
    monthKey: formatIST(visibleMonth, 'yyyy-MM'),
    today,
    todayEntries: live.data,
    now,
  });

  const entries = useMemo(() => day.data ?? [], [day.data]);
  const ranges = useMemo(() => getRanges(patient), [patient]);
  const doses = useMemo(
    () => resolveDoses(expectedDoses(medications, dateKey), entries, now),
    [medications, dateKey, entries, now],
  );
  const timeline = useMemo(
    () => buildTimeline({ entries, doses, ranges }),
    [entries, doses, ranges],
  );

  function changeDate(next) {
    setMonth(null);
    onChangeDate(next);
  }

  return (
    <div className="space-y-4">
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

      {day.loading ? (
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
