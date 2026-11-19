import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell.jsx';

export function NotFound() {
  return (
    <PageShell title="Page not found">
      <Link to="/" className="text-brand-600 underline">
        Go to start
      </Link>
    </PageShell>
  );
}
