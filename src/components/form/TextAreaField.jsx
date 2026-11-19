import { useId } from 'react';
import { FieldError } from './FieldError.jsx';
import { inputClass, labelClass } from './fieldStyles.js';

export function TextAreaField({ label, value, onChange, error, rows = 3, placeholder }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        className={`${inputClass} py-2`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
