import { useId } from 'react';
import { FieldError } from './FieldError.jsx';
import { inputClass, labelClass } from './fieldStyles.js';

/** `field` comes from useTimeField. */
export function TimeInput({ field, error }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        Time <span className="font-normal text-slate-500">(IST)</span>
      </label>
      <input
        id={id}
        type="time"
        className={inputClass}
        value={field.time}
        onChange={(e) => field.setTime(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
