import { formatIST } from '../../lib/time.js';
import { FLAG_TEXT } from './chartTheme.js';

/** Recharts tooltip content: time in IST and each series value with its status. */
export function ChartTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-900">{formatIST(point.at, 'EEE d MMM, h:mm a')}</p>
      {metric.series.map((s) =>
        point[s.key] == null ? null : (
          <p key={s.key} className="text-slate-700">
            {metric.series.length > 1 && <span className="text-slate-500">{s.label}: </span>}
            <span className="font-semibold text-slate-900">
              {point[s.key]} {metric.unit}
            </span>
            {point[`${s.key}Flag`] && (
              <span className="ml-1 font-semibold text-red-700">
                ⚠ {FLAG_TEXT[point[`${s.key}Flag`]]}
              </span>
            )}
          </p>
        ),
      )}
    </div>
  );
}
