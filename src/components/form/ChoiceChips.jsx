import { useId } from 'react';
import { FieldError } from './FieldError.jsx';
import { labelClass } from './fieldStyles.js';

/**
 * Single choice (or multiple with `multiple`) as large tap targets.
 * options: [{ value, label }]
 */
export function ChoiceChips({ label, options, value, onChange, error, multiple = false }) {
  const id = useId();
  const selected = (v) => (multiple ? (value ?? []).includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    const list = value ?? [];
    return onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={labelClass}>{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={selected(o.value)}
            onClick={() => toggle(o.value)}
            className={`min-h-10 rounded-full border px-3 text-sm font-medium transition-colors ${
              selected(o.value)
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}
