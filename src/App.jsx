import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/authContext.js';
import { RequireRole } from './auth/RequireRole.jsx';
import { homePathFor } from './auth/roles.js';
import { FullScreenLoader } from './components/FullScreenLoader.jsx';
import { FamilyHome } from './pages/FamilyHome.jsx';
import { Login } from './pages/Login.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { NurseHome } from './pages/NurseHome.jsx';

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
            <NurseHome />
          </RequireRole>
        }
      />
      <Route
        path="/family/*"
        element={
          <RequireRole role="family">
            <FamilyHome />
          </RequireRole>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
