const BUTTONS = [
  { type: 'vitals', icon: '🩺', text: 'Vitals' },
  { type: 'meal', icon: '🍽️', text: 'Meal' },
  { type: 'water-quick', icon: '💧', text: 'Water +250 ml' },
  { type: 'activity', icon: '🚶', text: 'Activity' },
  { type: 'mood', icon: '🙂', text: 'Mood' },
  { type: 'observation', icon: '📝', text: 'Note' },
];

/** onAdd(type) opens a form; onQuickWater() logs 250 ml now with one tap. */
export function QuickAdd({ onAdd, onQuickWater }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {BUTTONS.map((b) => (
          <button
            key={b.type}
            type="button"
            onClick={() => (b.type === 'water-quick' ? onQuickWater() : onAdd(b.type))}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-sm hover:bg-brand-50 active:bg-brand-100"
          >
            <span aria-hidden="true" className="text-xl">
              {b.icon}
            </span>
            {b.text}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onAdd('water')}
        className="mt-2 text-sm font-medium text-brand-700 underline"
      >
        Other water amount
      </button>
    </div>
  );
}
