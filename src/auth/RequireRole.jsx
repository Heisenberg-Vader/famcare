import { Navigate, useLocation } from 'react-router-dom';
import { FullScreenLoader } from '../components/FullScreenLoader.jsx';
import { useAuth } from './authContext.js';
import { homePathFor } from './roles.js';

/** Renders children only for a signed-in user with `role`; otherwise redirects. */
export function RequireRole({ role, children }) {
  const { status, role: userRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader label="Checking your account" />;
  if (status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (userRole !== role) return <Navigate to={homePathFor(userRole)} replace />;
  return children;
}
