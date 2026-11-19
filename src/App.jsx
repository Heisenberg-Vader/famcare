import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from './pages/Login.jsx';
import { NurseHome } from './pages/NurseHome.jsx';
import { FamilyHome } from './pages/FamilyHome.jsx';
import { NotFound } from './pages/NotFound.jsx';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/nurse/*" element={<NurseHome />} />
      <Route path="/family/*" element={<FamilyHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
