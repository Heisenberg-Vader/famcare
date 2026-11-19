import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatIST } from '../../lib/time.js';
import { ChartTooltip } from './ChartTooltip.jsx';
import { AXIS_TEXT, CRITICAL, FLAG_TEXT, GRID, SERIES_COLORS, SURFACE } from './chartTheme.js';

function makeDot(seriesKey, color) {
  function FlagDot({ cx, cy, payload, index }) {
    const key = `${seriesKey}-${index}`;
    if (payload?.[seriesKey] == null || cx == null || cy == null) return <g key={key} />;
    const flagged = Boolean(payload[`${seriesKey}Flag`]);
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={flagged ? 5 : 3}
        fill={flagged ? CRITICAL : color}
        stroke={SURFACE}
        strokeWidth={flagged ? 2 : 1.5}
      />
    );
  }
  return FlagDot;
}

function bandText(chart, unit) {
  if (chart.bands.length === 0)
    return 'No reference band · flagged when weight changes by more than 2 kg in 7 days';
  return `Normal ${chart.bands.map((b) => `${b.min}–${b.max}`).join(' / ')} ${unit}`;
}

/** One vitals chart: lines per series, shaded reference band(s), red out-of-range dots. */
export function MetricChart({ metric, chart, startMs, endMs, ticks }) {
  const colorOf = (key) =>
    SERIES_COLORS[metric.series.findIndex((s) => s.key === key)] ?? SERIES_COLORS[0];
  const total = chart.readings.length;
  const multi = metric.series.length > 1;

  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-3">
      <figcaption className="mb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{metric.title}</h3>
          <span className="text-xs text-slate-500">{metric.unit}</span>
        </div>
        <p className="text-xs text-slate-500">{bandText(chart, metric.unit)}</p>
        {total > 0 && (
          <p
            className={`mt-0.5 text-xs ${chart.outOfRange ? 'font-medium text-red-700' : 'text-slate-600'}`}
          >
            {chart.outOfRange ? '⚠ ' : ''}
            {chart.outOfRange} of {total} readings{' '}
            {metric.id === 'weightKg' ? 'flagged' : 'out of range'}
          </p>
        )}
        {multi && (
          <ul className="mt-1 flex gap-4 text-xs text-slate-700">
            {metric.series.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ background: SERIES_COLORS[i] }}
                  aria-hidden="true"
                />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>

      {total === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No readings in this period.</p>
      ) : (
        <div
          className="h-48"
          role="img"
          aria-label={`${metric.title} chart, ${total} readings, ${chart.outOfRange} ${metric.id === 'weightKg' ? 'flagged' : 'out of range'}. Table below.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              {chart.bands.map((b) => (
                <ReferenceArea
                  key={b.seriesKey}
                  y1={b.min}
                  y2={b.max}
                  fill={colorOf(b.seriesKey)}
                  fillOpacity={0.1}
                  stroke="none"
                  ifOverflow="hidden"
                />
              ))}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[startMs, endMs]}
                ticks={ticks}
                tickFormatter={(t) => formatIST(t, 'd MMM')}
                tick={{ fontSize: 11, fill: AXIS_TEXT }}
                stroke={GRID}
              />
              <YAxis
                domain={chart.domain}
                width={38}
                tick={{ fontSize: 11, fill: AXIS_TEXT }}
                stroke={GRID}
                allowDecimals={metric.id === 'tempF' || metric.id === 'weightKg'}
              />
              <Tooltip
                content={<ChartTooltip metric={metric} />}
                cursor={{ stroke: AXIS_TEXT, strokeDasharray: '3 3' }}
              />
              {metric.series.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={colorOf(s.key)}
                  strokeWidth={2}
                  connectNulls
                  dot={makeDot(s.key, colorOf(s.key))}
                  activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {total > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-brand-700">Show readings table</summary>
          <div className="mt-2 max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-slate-500">
                <tr>
                  <th className="py-1 font-medium">When</th>
                  {multi && <th className="py-1 font-medium">Reading</th>}
                  <th className="py-1 text-right font-medium">Value</th>
                  <th className="py-1 pl-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...chart.readings].reverse().map((r) => (
                  <tr key={`${r.t}-${r.seriesKey}`}>
                    <td className="py-1 text-slate-600">{formatIST(r.at, 'd MMM, h:mm a')}</td>
                    {multi && <td className="py-1 text-slate-600">{r.label}</td>}
                    <td className="py-1 text-right text-slate-900 tabular-nums">{r.value}</td>
                    <td
                      className={`py-1 pl-2 ${r.flag ? 'font-medium text-red-700' : 'text-slate-500'}`}
                    >
                      {r.flag ? `⚠ ${FLAG_TEXT[r.flag]}${r.note ? ` (${r.note})` : ''}` : 'Normal'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
