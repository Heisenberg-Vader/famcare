import { useMemo } from 'react';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { getEntriesBetween } from '../../data/entries.js';
import { useAsync } from '../../hooks/useAsync.js';
import { moodWord } from '../../lib/entryText.js';
import { compareSummary } from '../../lib/summaries.js';
import { addDaysToKey, formatDateKey } from '../../lib/time.js';
import { MiniBars } from './MiniBars.jsx';
import { Sparkline } from './Sparkline.jsx';

const ARROWS = { up: '↑', down: '↓', flat: '→' };

function Delta({ current, previous, unit = '', suffix = 'vs previous 7 days' }) {
  if (current == null || previous == null) {
    return <p className="text-xs text-slate-500">No data for the previous 7 days</p>;
  }
  const diff = Math.round((current - previous) * 10) / 10;
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  return (
    <p className="text-xs text-slate-600">
      <span aria-hidden="true">{ARROWS[dir]} </span>
      {diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff}${unit}`} {suffix}
      <span className="text-slate-400">
        {' '}
        (was {previous}
        {unit})
      </span>
    </p>
  );
}

function Tile({ title, value, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-medium text-slate-600">{title}</h3>
      <p className="mt-0.5 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </section>
  );
}

const range = (s) => `${formatDateKey(s.startKey, 'd MMM')} – ${formatDateKey(s.endKey, 'd MMM')}`;

/**
 * The last 7 complete days (ending yesterday) vs the 7 before. Today is left out because a
 * half-finished day would understate meals, water and activity.
 */
export function WeeklySummary({ patient, medications, today, now }) {
  const endKey = addDaysToKey(today, -1);
  const history = useAsync(
    () => getEntriesBetween(patient.id, addDaysToKey(endKey, -13), endKey),
    `${patient.id}|${endKey}`,
  );
  const summary = useMemo(
    () =>
      history.data ? compareSummary({ entries: history.data, medications, endKey, now }) : null,
    [history.data, medications, endKey, now],
  );

  if (history.loading) return <Spinner label="Loading summary" />;
  if (history.error) return <ErrorState error={history.error} />;
  if (!summary) return null;

  const { current: c, previous: p } = summary;
  const moodDir = summary.moodDirection;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-base font-semibold text-slate-800">Last 7 full days</h2>
        <p className="text-xs text-slate-500">
          {range(c)} compared with {range(p)}. Today is shown on the Day tab.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Tile
          title="Medicine adherence"
          value={c.adherence.percent == null ? '–' : `${c.adherence.percent}%`}
        >
          <p className="text-xs text-slate-600">
            {c.adherence.given} of {c.adherence.expected} due doses given
          </p>
          <p className="text-xs text-slate-600">
            {c.adherence.notRecorded} not recorded ·{' '}
            {c.adherence.missed + c.adherence.refused + c.adherence.held} missed, refused or held
          </p>
          <Delta current={c.adherence.percent} previous={p.adherence.percent} unit=" pts" />
        </Tile>

        <Tile title="Meals completed" value={c.meals.percent == null ? '–' : `${c.meals.percent}%`}>
          <p className="text-xs text-slate-600">
            {c.meals.completed} of {c.meals.expected} main meals mostly eaten (¾ or more)
          </p>
          <Delta current={c.meals.percent} previous={p.meals.percent} unit=" pts" />
        </Tile>

        <Tile title="Activity" value={`${c.activity.total} min`}>
          <MiniBars
            data={c.activity.perDay.map((d) => ({ dateKey: d.dateKey, value: d.minutes }))}
            unit="min"
            label="Activity minutes per day"
          />
          <Delta current={c.activity.total} previous={p.activity.total} unit=" min" />
        </Tile>

        <Tile
          title="Mood"
          value={
            c.mood.average == null ? (
              '–'
            ) : (
              <>
                {c.mood.average}
                <span className="text-base font-normal text-slate-500">
                  /5 · {moodWord(Math.round(c.mood.average))}
                </span>
                {moodDir && (
                  <span className="ml-2 text-lg" aria-label={`trend ${moodDir}`}>
                    {ARROWS[moodDir]}
                  </span>
                )}
              </>
            )
          }
        >
          <Sparkline
            data={c.mood.daily.map((d) => ({ dateKey: d.dateKey, value: d.average }))}
            min={1}
            max={5}
            label="Daily average mood"
          />
          <Delta current={c.mood.average} previous={p.mood.average} />
        </Tile>

        <Tile title="Water" value={`${c.water.averageMl} ml/day`}>
          <Delta current={c.water.averageMl} previous={p.water.averageMl} unit=" ml" />
        </Tile>
      </div>
    </div>
  );
}
