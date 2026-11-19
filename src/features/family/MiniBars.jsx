import { formatDateKey } from '../../lib/time.js';
import { AXIS_TEXT, SERIES_COLORS } from './chartTheme.js';

/** Small per-day bar chart. data: [{ dateKey, value }]. */
export function MiniBars({ data, unit, label }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 28;
  const H = 56;
  return (
    <svg
      viewBox={`0 0 ${data.length * W} ${H + 14}`}
      className="h-[70px] w-full"
      role="img"
      aria-label={`${label}: ${data.map((d) => `${formatDateKey(d.dateKey, 'EEE')} ${d.value} ${unit}`).join(', ')}`}
    >
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max(3, (d.value / max) * H) : 0;
        return (
          <g key={d.dateKey}>
            <title>{`${formatDateKey(d.dateKey, 'EEE d MMM')}: ${d.value} ${unit}`}</title>
            <rect x={i * W + 5} y={0} width={W - 10} height={H} fill="transparent" />
            {h > 0 && (
              <rect
                x={i * W + 6}
                y={H - h}
                width={W - 12}
                height={h}
                rx={4}
                fill={SERIES_COLORS[0]}
              />
            )}
            <text x={i * W + W / 2} y={H + 12} textAnchor="middle" fontSize="10" fill={AXIS_TEXT}>
              {formatDateKey(d.dateKey, 'EEEEE')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
