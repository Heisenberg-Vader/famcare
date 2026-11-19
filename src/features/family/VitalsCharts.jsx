import { useMemo, useState } from 'react';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { getVitalsSince } from '../../data/entries.js';
import { useAsync } from '../../hooks/useAsync.js';
import { CHART_METRICS, buildChart, mergeToday } from '../../lib/chartData.js';
import { RANGES_DISCLAIMER, getRanges } from '../../lib/ranges.js';
import { addDaysToKey, atIST, dayRange, lastNDays } from '../../lib/time.js';
import { MetricChart } from './MetricChart.jsx';

const PERIODS = [7, 30];
// Fetch 7 extra days so weight at the start of the 30-day window can compare with a week earlier.
const FETCH_DAYS = 37;

export function VitalsCharts({ patient, live, today }) {
  const [days, setDays] = useState(7);
  const vitals = useAsync(
    () => getVitalsSince(patient.id, atIST(addDaysToKey(today, -(FETCH_DAYS - 1)), '00:00')),
    `${patient.id}|${today}`,
  );
  const ranges = useMemo(() => getRanges(patient), [patient]);
  const entries = useMemo(
    () =>
      mergeToday(
        vitals.data,
        (live.data ?? []).filter((e) => e.type === 'vitals'),
        today,
      ),
    [vitals.data, live.data, today],
  );

  const span = useMemo(() => {
    const keys = lastNDays(today, days);
    const step = days > 7 ? 5 : 1;
    return {
      startMs: dayRange(keys[0]).start.getTime(),
      endMs: dayRange(today).end.getTime(),
      ticks: keys
        .filter((_, i) => (keys.length - 1 - i) % step === 0)
        .map((k) => atIST(k, '12:00').getTime()),
    };
  }, [today, days]);

  const charts = useMemo(
    () =>
      CHART_METRICS.map((m) => ({
        metric: m,
        chart: buildChart(m, entries, { ...span, ranges }),
      })),
    [entries, span, ranges],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Period" className="inline-flex rounded-lg bg-slate-200 p-1">
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`min-h-9 rounded-md px-4 text-sm font-medium ${
                days === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
        <p className="text-right text-xs text-slate-500">{RANGES_DISCLAIMER}</p>
      </div>
      {vitals.loading && <Spinner label="Loading vitals" />}
      {vitals.error && <ErrorState error={vitals.error} />}
      {vitals.data &&
        charts.map(({ metric, chart }) => (
          <MetricChart
            key={metric.id}
            metric={metric}
            chart={chart}
            startMs={span.startMs}
            endMs={span.endMs}
            ticks={span.ticks}
          />
        ))}
    </div>
  );
}
