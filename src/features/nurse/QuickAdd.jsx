import { Icon } from '../../components/Icon.jsx';

const BUTTONS = [
  { type: 'vitals', icon: 'vitals', text: 'Vitals' },
  { type: 'meal', icon: 'meal', text: 'Meal' },
  { type: 'water-quick', icon: 'water', text: 'Water +250 ml' },
  { type: 'activity', icon: 'activity', text: 'Activity' },
  { type: 'mood', icon: 'mood', text: 'Mood' },
  { type: 'observation', icon: 'observation', text: 'Note' },
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
            <Icon name={b.icon} size={24} className="text-brand-700" />
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
