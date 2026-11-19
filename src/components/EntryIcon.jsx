import { Icon } from './Icon.jsx';

const TONES = {
  normal: 'bg-brand-50 text-brand-700',
  alert: 'bg-red-100 text-red-700',
  warn: 'bg-amber-100 text-amber-800',
  missing: 'bg-slate-100 text-slate-400',
};

/** Round badge with the entry type's icon, tinted by tone. */
export function EntryIcon({ type, tone = 'normal' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONES[tone] ?? TONES.normal}`}
    >
      <Icon name={type} size={18} />
    </span>
  );
}
