// Everything the 30-day PDF report shows, as plain data. Pure, so it is tested without a
// PDF library and shares one implementation with the charts and the weekly summary.
import { CHART_METRICS, buildChart, seriesStats } from './chartData.js';
import { describeEntry, moodWord } from './entryText.js';
import { LABELS, PORTION_LABELS } from './entries.js';
import { DEFAULT_RANGES } from './ranges.js';
import { expectedDoses, resolveDoses } from './schedule.js';
import { MAIN_MEALS, adherenceByMedication, periodSummary } from './summaries.js';
import { addDaysToKey, ageFromDob, dayRange, lastNDays, toDate } from './time.js';

export const REPORT_DAYS = 30;
// Weight compares with the reading a week earlier, so load 7 more days than the report shows.
export const REPORT_LOOKBACK_DAYS = 7;
export const REPORT_DISCLAIMER = 'Compiled from caregiver logs. Not a diagnostic document.';

const DOSE_PROBLEMS = ['missed', 'refused', 'held', 'not_recorded'];
const MEAL_INITIALS = { breakfast: 'B', lunch: 'L', snack: 'S', dinner: 'D' };

/** The report's days: the REPORT_DAYS complete days ending the day before `today`. */
export function reportPeriod(today, days = REPORT_DAYS) {
  const endKey = addDaysToKey(today, -1);
  const dateKeys = lastNDays(endKey, days);
  return {
    dateKeys,
    startKey: dateKeys[0],
    endKey,
    fetchStartKey: addDaysToKey(dateKeys[0], -REPORT_LOOKBACK_DAYS),
  };
}

const byAt = (a, b) => toDate(a.at) - toDate(b.at);

function rangeText(band) {
  return band ? `${band.min}-${band.max}` : '';
}

/** One compact row per day: doses, meals, water, activity, mood, vitals and notes. */
function dailyRow(dateKey, entries, doses, ranges) {
  const day = entries.filter((e) => e.dateKey === dateKey);
  const of = (type) => day.filter((e) => e.type === type);
  const dayDoses = doses.filter((d) => d.dateKey === dateKey && d.status !== 'pending');
  const given = dayDoses.filter((d) => d.status === 'given').length;

  const bestMeal = new Map();
  for (const m of of('meal')) {
    bestMeal.set(m.slot, Math.max(bestMeal.get(m.slot) ?? 0, Number(m.portion) || 0));
  }
  const meals = ['breakfast', 'lunch', 'snack', 'dinner']
    .filter((slot) => bestMeal.has(slot) || MAIN_MEALS.includes(slot))
    .map(
      (slot) =>
        `${MEAL_INITIALS[slot]} ${bestMeal.has(slot) ? PORTION_LABELS[bestMeal.get(slot)] : '-'}`,
    )
    .join(' ');

  const moods = of('mood').map((m) => Number(m.score));
  const mood = moods.length
    ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10
    : null;

  const vitals = of('vitals');
  const flaggedVitals = vitals.filter((v) => describeEntry(v, ranges).tone === 'alert').length;
  const observations = of('observation');

  return {
    dateKey,
    doses: dayDoses.length ? `${given}/${dayDoses.length}` : '-',
    dosesOk: given === dayDoses.length,
    meals,
    waterMl: of('water').reduce((s, e) => s + (Number(e.ml) || 0), 0),
    activityMin: of('activity').reduce((s, e) => s + (Number(e.durationMin) || 0), 0),
    mood,
    moodText: mood == null ? '-' : `${mood} ${moodWord(Math.round(mood))}`,
    vitals: vitals.length,
    vitalsFlagged: flaggedVitals,
    concerns: observations.filter((o) => o.severity === 'concern').length,
    notes: observations.length,
  };
}

/**
 * entries: every entry from period.fetchStartKey to period.endKey (any order).
 * Returns the report contents; dates are IST date keys and instants are Dates.
 */
export function buildReportData({
  patient,
  medications,
  entries,
  today,
  now = new Date(),
  ranges = DEFAULT_RANGES,
  days = REPORT_DAYS,
}) {
  const period = reportPeriod(today, days);
  const keys = new Set(period.dateKeys);
  const all = [...(entries ?? [])].sort(byAt);
  const inPeriod = all.filter((e) => keys.has(e.dateKey));

  const doses = resolveDoses(
    expectedDoses(medications, period.startKey, period.endKey),
    inPeriod,
    now,
  );
  const summary = periodSummary({
    entries: inPeriod,
    medications,
    dateKeys: period.dateKeys,
    now,
  });

  const span = {
    startMs: dayRange(period.startKey).start.getTime(),
    endMs: dayRange(period.endKey).end.getTime() - 1,
    ranges,
  };
  // Earlier vitals are passed in so weight at the start of the period can be compared.
  const charts = CHART_METRICS.map((metric) => {
    const chart = buildChart(metric, all, span);
    const bandOf = (key) => chart.bands.find((b) => b.seriesKey === key);
    return {
      metric,
      chart,
      stats: seriesStats(chart).map((s) => ({ ...s, normal: rangeText(bandOf(s.seriesKey)) })),
    };
  });

  const outOfRange = charts
    .flatMap(({ metric, chart }) =>
      chart.readings
        .filter((r) => r.flag)
        .map((r) => ({
          at: r.at,
          metric: metric.series.length > 1 ? `${metric.title} (${r.label})` : metric.title,
          value: `${r.value} ${metric.unit}`,
          normal: rangeText(chart.bands.find((b) => b.seriesKey === r.seriesKey)),
          flag: r.flag,
          note: r.note,
        })),
    )
    .sort(byAt);

  const doseIssues = doses
    .filter((d) => DOSE_PROBLEMS.includes(d.status))
    .map((d) => ({
      dateKey: d.dateKey,
      scheduledAt: d.scheduledAt,
      scheduledTime: d.scheduledTime,
      medication: [d.medicationName, d.strength].filter(Boolean).join(' '),
      status: d.status,
      statusText: d.status === 'not_recorded' ? 'Not recorded' : LABELS[d.status],
      reason: d.entry?.reason ?? '',
      recordedBy: d.entry?.nurseName ?? '',
    }));

  const concerns = inPeriod
    .filter((e) => e.type === 'observation' && e.severity === 'concern')
    .map((e) => ({ at: toDate(e.at), text: e.text, nurseName: e.nurseName ?? '' }));

  const medsById = new Map((medications ?? []).map((m) => [m.id, m]));
  const perMedication = adherenceByMedication(doses).map((m) => {
    const med = medsById.get(m.medicationId);
    return {
      ...m,
      times: med?.times ?? [],
      dose: med?.dose ?? '',
      active: med ? med.active !== false && (!med.endDate || med.endDate >= period.endKey) : true,
      endDate: med?.endDate ?? null,
    };
  });

  return {
    generatedAt: now,
    period,
    patient: {
      fullName: patient?.fullName ?? '',
      age: ageFromDob(patient?.dob, now),
      gender: patient?.gender ?? '',
      city: patient?.city ?? '',
      conditions: patient?.conditions ?? [],
      primaryDoctor: patient?.primaryDoctor ?? '',
      nurses: (patient?.nurses ?? []).map((n) => n.fullName),
    },
    summary,
    charts,
    perMedication,
    outOfRange,
    doseIssues,
    concerns,
    daily: period.dateKeys.map((k) => dailyRow(k, inPeriod, doses, ranges)),
    totals: { entries: inPeriod.length },
  };
}
