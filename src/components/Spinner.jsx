export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600"
        aria-hidden="true"
      />
      <span role="status">{label}…</span>
    </div>
  );
}
