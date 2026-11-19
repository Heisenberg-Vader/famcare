export function ErrorState({ error }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800"
    >
      {error?.message ?? 'Something went wrong. Please try again.'}
    </div>
  );
}
