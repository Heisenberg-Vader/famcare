import { forwardRef } from 'react';
import { bandText } from '../../lib/chartData.js';
import { atIST } from '../../lib/time.js';
import { MetricPlot } from '../family/MetricPlot.jsx';
import { SERIES_COLORS } from '../family/chartTheme.js';

export const PRINT_WIDTH = 720;
const PLOT_HEIGHT = 190;

/**
 * Static, fixed-size copies of the vitals charts for the PDF, rendered off screen and
 * captured with html-to-image. Each figure carries data-chart-id.
 */
export const ReportCharts = forwardRef(function ReportCharts({ data }, ref) {
  const { dateKeys } = data.period;
  const startMs = atIST(dateKeys[0], '00:00').getTime();
  const endMs = atIST(dateKeys[dateKeys.length - 1], '23:59').getTime();
  const ticks = dateKeys
    .filter((_, i) => (dateKeys.length - 1 - i) % 5 === 0)
    .map((k) => atIST(k, '12:00').getTime());

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', left: -10000, top: 0, width: PRINT_WIDTH, pointerEvents: 'none' }}
    >
      {data.charts
        .filter(({ chart }) => chart.readings.length > 0)
        .map(({ metric, chart }) => (
          <figure
            key={metric.id}
            data-chart-id={metric.id}
            className="bg-white px-2 pt-2 pb-1 text-slate-900"
            style={{ width: PRINT_WIDTH }}
          >
            <figcaption className="mb-1 flex items-baseline gap-3 text-sm">
              <span className="font-semibold">
                {metric.title} ({metric.unit})
              </span>
              <span className="text-xs text-slate-600">{bandText(chart, metric.unit)}</span>
              {metric.series.length > 1 &&
                metric.series.map((s, i) => (
                  <span key={s.key} className="flex items-center gap-1 text-xs text-slate-700">
                    <span
                      className="inline-block h-0.5 w-4"
                      style={{ background: SERIES_COLORS[i] }}
                    />
                    {s.label}
                  </span>
                ))}
              <span className="ml-auto text-xs text-slate-700">
                {chart.outOfRange} of {chart.readings.length}{' '}
                {metric.id === 'weightKg' ? 'flagged' : 'out of range'}
              </span>
            </figcaption>
            <MetricPlot
              metric={metric}
              chart={chart}
              startMs={startMs}
              endMs={endMs}
              ticks={ticks}
              width={PRINT_WIDTH - 16}
              height={PLOT_HEIGHT}
            />
          </figure>
        ))}
    </div>
  );
});
