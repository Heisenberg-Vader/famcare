import { formatDateKey } from '../../lib/time.js';
import { SERIES_COLORS, SURFACE } from './chartTheme.js';

/** Daily values on a fixed min..max scale; gaps where a day has no value. */
export function Sparkline({ data, min, max, label }) {
  const W = 168;
  const H = 40;
  const x = (i) => (data.length < 2 ? W / 2 : (i / (data.length - 1)) * (W - 8) + 4);
  const y = (v) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  const segments = [];
  let current = [];
  data.forEach((d, i) => {
    if (d.value == null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push(`${x(i)},${y(d.value)}`);
  });
  if (current.length) segments.push(current);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-10 w-full"
      role="img"
      aria-label={`${label}: ${data.map((d) => `${formatDateKey(d.dateKey, 'EEE')} ${d.value ?? 'no data'}`).join(', ')}`}
    >
      {segments.map((pts) => (
        <polyline
          key={pts[0]}
          points={pts.join(' ')}
          fill="none"
          stroke={SERIES_COLORS[0]}
          strokeWidth="2"
        />
      ))}
      {data.map((d, i) =>
        d.value == null ? null : (
          <circle
            key={d.dateKey}
            cx={x(i)}
            cy={y(d.value)}
            r="3"
            fill={SERIES_COLORS[0]}
            stroke={SURFACE}
            strokeWidth="1.5"
          >
            <title>{`${formatDateKey(d.dateKey, 'EEE d MMM')}: ${d.value}`}</title>
          </circle>
        ),
      )}
    </svg>
  );
}
