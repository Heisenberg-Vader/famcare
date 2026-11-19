export function PageShell({ title, children }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:max-w-2xl">
      {title && <h1 className="mb-4 text-2xl font-semibold text-brand-700">{title}</h1>}
      {children}
    </div>
  );
}
