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
import { AXIS_TEXT, CRITICAL, GRID, SERIES_COLORS, SURFACE } from './chartTheme.js';

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

/**
 * The plot of one vitals chart: a line per series, shaded reference band(s) and red
 * out-of-range dots. Fills its parent unless width and height are given (PDF capture).
 */
export function MetricPlot({ metric, chart, startMs, endMs, ticks, width, height, interactive }) {
  const colorOf = (key) =>
    SERIES_COLORS[metric.series.findIndex((s) => s.key === key)] ?? SERIES_COLORS[0];

  const plot = (
    <LineChart
      data={chart.points}
      width={width}
      height={height}
      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
    >
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
      {interactive && (
        <Tooltip
          content={<ChartTooltip metric={metric} />}
          cursor={{ stroke: AXIS_TEXT, strokeDasharray: '3 3' }}
        />
      )}
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
          activeDot={interactive ? { r: 6, stroke: SURFACE, strokeWidth: 2 } : false}
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  );

  if (width && height) return plot;
  return (
    <ResponsiveContainer width="100%" height="100%">
      {plot}
    </ResponsiveContainer>
  );
}
