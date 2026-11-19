import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/authContext.js';
import { IdleSignOut } from './auth/IdleSignOut.jsx';
import { RequireRole } from './auth/RequireRole.jsx';
import { homePathFor } from './auth/roles.js';
import { FullScreenLoader } from './components/FullScreenLoader.jsx';
import { Login } from './pages/Login.jsx';
import { NotFound } from './pages/NotFound.jsx';

// Each role's screens load only after sign-in, so neither downloads the other's code.
const NurseHome = lazy(() =>
  import('./pages/NurseHome.jsx').then((m) => ({ default: m.NurseHome })),
);
const FamilyHome = lazy(() =>
  import('./pages/FamilyHome.jsx').then((m) => ({ default: m.FamilyHome })),
);

function RootRedirect() {
  const { status, role } = useAuth();
  if (status === 'loading') return <FullScreenLoader label="Checking your account" />;
  return <Navigate to={status === 'signedIn' ? homePathFor(role) : '/login'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/nurse/*"
        element={
          <RequireRole role="nurse">
            <IdleSignOut />
            <Suspense fallback={<FullScreenLoader label="Loading" />}>
              <NurseHome />
            </Suspense>
          </RequireRole>
        }
      />
      <Route
        path="/family/*"
        element={
          <RequireRole role="family">
            <Suspense fallback={<FullScreenLoader label="Loading" />}>
              <FamilyHome />
            </Suspense>
          </RequireRole>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
