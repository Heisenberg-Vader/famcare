import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell.jsx';

export function NotFound() {
  return (
    <PageShell title="Page not found">
      <p className="mb-4 text-slate-600">That page does not exist.</p>
      <Link to="/" className="font-medium text-brand-600 underline">
        Go to my home page
      </Link>
    </PageShell>
  );
}
