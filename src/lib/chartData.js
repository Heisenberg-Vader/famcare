// Shapes vitals entries into chart series with reference bands and out-of-range flags.
// Pure, so the charts, the PDF report and tests share one implementation.
import { DEFAULT_RANGES, classify, weightChange } from './ranges.js';
import { toDate } from './time.js';

export const CHART_METRICS = Object.freeze([
  {
    id: 'bp',
    title: 'Blood pressure',
    unit: 'mmHg',
    series: [
      { key: 'systolic', label: 'Systolic', rangeKey: 'systolic' },
      { key: 'diastolic', label: 'Diastolic', rangeKey: 'diastolic' },
    ],
  },
  {
    id: 'pulse',
    title: 'Pulse',
    unit: 'bpm',
    series: [{ key: 'pulse', label: 'Pulse', rangeKey: 'pulse' }],
  },
  {
    id: 'spo2',
    title: 'SpO2',
    unit: '%',
    series: [{ key: 'spo2', label: 'SpO2', rangeKey: 'spo2' }],
  },
  {
    id: 'sugar',
    title: 'Blood sugar',
    unit: 'mg/dL',
    series: [
      { key: 'sugarFasting', label: 'Fasting', rangeKey: 'sugarFasting' },
      { key: 'sugarOther', label: 'After meal / random', rangeKey: 'sugarPostMeal' },
    ],
  },
  {
    id: 'tempF',
    title: 'Temperature',
    unit: '°F',
    series: [{ key: 'tempF', label: 'Temperature', rangeKey: 'tempF' }],
  },
  {
    id: 'weightKg',
    title: 'Weight',
    unit: 'kg',
    series: [{ key: 'weightKg', label: 'Weight', rangeKey: null }],
  },
]);

/** The reading for a chart series on an entry, with the context classify() needs. */
function readingFor(seriesKey, entry) {
  if (seriesKey === 'sugarFasting') {
    return entry.sugarContext === 'fasting' ? { metric: 'sugar', value: entry.sugar } : null;
  }
  if (seriesKey === 'sugarOther') {
    return entry.sugar != null && entry.sugarContext !== 'fasting'
      ? { metric: 'sugar', value: entry.sugar }
      : null;
  }
  return { metric: seriesKey, value: entry[seriesKey] };
}

/**
 * metric: one of CHART_METRICS. entries: vitals entries (any order, may extend before
 * startMs so weight can compare with 7 days earlier). Only readings in [startMs, endMs] plot.
 * Returns { points, bands, readings, outOfRange, domain }.
 *   points:   [{ t, at, [seriesKey]: value, [seriesKey + 'Flag']: 'low'|'high'|'change'|null }]
 *   readings: flat list [{ t, at, seriesKey, label, value, flag, note }]
 */
export function buildChart(metric, entries, { startMs, endMs, ranges = DEFAULT_RANGES }) {
  const vitals = (entries ?? []).filter((e) => e.type === 'vitals');
  const points = [];
  const readings = [];

  for (const entry of [...vitals].sort((a, b) => toDate(a.at) - toDate(b.at))) {
    const at = toDate(entry.at);
    const t = at.getTime();
    if (t < startMs || t > endMs) continue;
    const point = { t, at };
    let any = false;
    for (const s of metric.series) {
      const r = readingFor(s.key, entry);
      if (r?.value == null) continue;
      let flag = null;
      let note = null;
      if (metric.id === 'weightKg') {
        const change = weightChange(entry, vitals);
        if (change?.flagged) {
          flag = 'change';
          note = `${change.deltaKg > 0 ? '+' : ''}${change.deltaKg} kg vs 7 days earlier`;
        }
      } else {
        const c = classify(r.metric, r.value, { sugarContext: entry.sugarContext, ranges });
        flag = c === 'low' || c === 'high' ? c : null;
      }
      point[s.key] = r.value;
      point[`${s.key}Flag`] = flag;
      readings.push({ t, at, seriesKey: s.key, label: s.label, value: r.value, flag, note });
      any = true;
    }
    if (any) points.push(point);
  }

  const bands = metric.series
    .filter((s) => s.rangeKey && ranges[s.rangeKey])
    .map((s) => ({ seriesKey: s.key, label: s.label, ...ranges[s.rangeKey] }));

  const values = readings.map((r) => r.value);
  const lo = Math.min(...values, ...bands.map((b) => b.min));
  const hi = Math.max(...values, ...bands.map((b) => b.max));
  const pad = Number.isFinite(lo) ? Math.max((hi - lo) * 0.08, metric.id === 'tempF' ? 0.3 : 1) : 0;
  const domain = Number.isFinite(lo) ? [niceFloor(lo - pad), niceCeil(hi + pad)] : [0, 1];

  return {
    points,
    bands,
    readings,
    outOfRange: readings.filter((r) => r.flag).length,
    domain,
  };
}

function niceFloor(x) {
  return Math.abs(x) < 20 ? Math.floor(x * 2) / 2 : Math.floor(x / 5) * 5;
}

function niceCeil(x) {
  return Math.abs(x) < 20 ? Math.ceil(x * 2) / 2 : Math.ceil(x / 5) * 5;
}

/** Caption describing a chart's normal band(s). */
export function bandText(chart, unit) {
  if (chart.bands.length === 0)
    return 'No reference band · flagged when weight changes by more than 2 kg in 7 days';
  return `Normal ${chart.bands.map((b) => `${b.min}–${b.max}`).join(' / ')} ${unit}`;
}

/** Summary statistics per chart series: min, max, average and out-of-range count. */
export function seriesStats(chart) {
  const bySeries = new Map();
  for (const r of chart.readings) {
    if (!bySeries.has(r.seriesKey)) bySeries.set(r.seriesKey, []);
    bySeries.get(r.seriesKey).push(r);
  }
  return [...bySeries.entries()].map(([seriesKey, rs]) => {
    const values = rs.map((r) => r.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      seriesKey,
      label: rs[0].label,
      count: rs.length,
      min: Math.min(...values),
      max: Math.max(...values),
      average: Math.round(avg * 10) / 10,
      outOfRange: rs.filter((r) => r.flag).length,
    };
  });
}

/** Replaces the fetched copy of today with the live entries so new readings show at once. */
export function mergeToday(history, live, today) {
  return [...(history ?? []).filter((e) => e.dateKey !== today), ...(live ?? [])];
}
