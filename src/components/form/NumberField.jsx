import { useId } from 'react';
import { FieldError } from './FieldError.jsx';
import { inputClass, labelClass } from './fieldStyles.js';

export function NumberField({ label, unit, value, onChange, error, step = 1, min, max }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {unit && <span className="font-normal text-slate-500"> ({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        step={step}
        min={min}
        max={max}
        className={inputClass}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
