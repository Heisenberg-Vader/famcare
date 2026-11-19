import { MAIN_MEALS, dayProgress } from '../../lib/summaries.js';

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm ring-1 ring-slate-200">
      <p className={`text-base font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export function DaySummaryStrip({ entries, medications, dateKey, now }) {
  const p = dayProgress({ entries, medications, dateKey, now });
  const water = entries.filter((e) => e.type === 'water').reduce((s, e) => s + (e.ml || 0), 0);
  const meals = new Set(
    entries.filter((e) => e.type === 'meal' && MAIN_MEALS.includes(e.slot)).map((e) => e.slot),
  ).size;
  const doseTone = p.dosesNotGiven + p.dosesNotRecorded > 0 ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="grid grid-cols-4 gap-2">
      <Stat label="doses given" value={`${p.dosesGiven}/${p.dosesScheduled}`} tone={doseTone} />
      <Stat label="vitals" value={p.vitalsCount} />
      <Stat label="main meals" value={`${meals}/3`} />
      <Stat
        label="water"
        value={water >= 1000 ? `${(water / 1000).toFixed(1)} L` : `${water} ml`}
      />
    </div>
  );
}
