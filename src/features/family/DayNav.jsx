import { Button } from '../../components/Button.jsx';
import { addDaysToKey, formatDateKey } from '../../lib/time.js';

export function DayNav({ dateKey, today, onChange, calendarOpen, onToggleCalendar }) {
  const isToday = dateKey === today;
  const yesterday = addDaysToKey(today, -1);
  const title = isToday
    ? 'Today'
    : dateKey === yesterday
      ? 'Yesterday'
      : formatDateKey(dateKey, 'EEEE');
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        aria-label="Previous day"
        onClick={() => onChange(addDaysToKey(dateKey, -1))}
        className="px-3"
      >
        ←
      </Button>
      <button
        type="button"
        onClick={onToggleCalendar}
        aria-expanded={calendarOpen}
        className="flex min-h-11 flex-1 flex-col items-center justify-center rounded-lg px-2 leading-tight hover:bg-slate-100"
      >
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-xs text-slate-500">
          {formatDateKey(dateKey, 'd MMM yyyy')} · {calendarOpen ? 'hide' : 'calendar'}
        </span>
      </button>
      <Button
        variant="secondary"
        aria-label="Next day"
        disabled={isToday}
        onClick={() => onChange(addDaysToKey(dateKey, 1))}
        className="px-3"
      >
        →
      </Button>
      <Button
        variant={isToday ? 'secondary' : 'primary'}
        disabled={isToday}
        onClick={() => onChange(today)}
      >
        Today
      </Button>
    </div>
  );
}
