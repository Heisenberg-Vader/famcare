const ICONS = {
  vitals: '🩺',
  meal: '🍽️',
  water: '💧',
  medication: '💊',
  activity: '🚶',
  mood: '🙂',
  observation: '📝',
};

const TONES = {
  normal: 'bg-slate-100',
  alert: 'bg-red-100',
  warn: 'bg-amber-100',
  missing: 'bg-slate-100 opacity-60',
};

export function EntryIcon({ type, tone = 'normal' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${TONES[tone] ?? TONES.normal}`}
    >
      {ICONS[type] ?? '•'}
    </span>
  );
}
