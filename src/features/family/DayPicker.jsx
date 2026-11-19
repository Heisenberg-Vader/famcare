import { DayPicker as ReactDayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { TZ, addDaysToKey, atIST, formatIST, toDateKey } from '../../lib/time.js';

/**
 * Month calendar in IST. flags: Map dateKey -> { outOfRange, doseIssue } (red / amber dots).
 * Days after today are disabled.
 */
export function DayPicker({ dateKey, today, month, onMonthChange, onSelect, flags }) {
  const has = (kind) => (date) => Boolean(flags.get(toDateKey(date))?.[kind]);
  return (
    <ReactDayPicker
      mode="single"
      timeZone={TZ}
      noonSafe
      required
      weekStartsOn={1}
      selected={atIST(dateKey, '12:00')}
      onSelect={(date) => date && onSelect(toDateKey(date))}
      month={month}
      onMonthChange={onMonthChange}
      startMonth={atIST(addDaysToKey(today, -365), '12:00')}
      endMonth={atIST(today, '12:00')}
      disabled={{ after: atIST(today, '12:00') }}
      modifiers={{ cpAlert: has('outOfRange'), cpDose: has('doseIssue') }}
      modifiersClassNames={{ cpAlert: 'cp-flag cp-flag-alert', cpDose: 'cp-flag cp-flag-dose' }}
      labels={{
        labelDayButton: (date, modifiers) =>
          [
            formatIST(date, 'EEEE d MMMM yyyy'),
            modifiers.cpAlert && 'out-of-range reading',
            modifiers.cpDose && 'missed or unrecorded dose',
            modifiers.selected && 'selected',
          ]
            .filter(Boolean)
            .join(', '),
      }}
    />
  );
}
