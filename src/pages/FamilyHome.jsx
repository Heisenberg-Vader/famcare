import { Route, Routes } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader.jsx';
import { OfflineBanner } from '../components/OfflineBanner.jsx';
import { Dashboard } from '../features/family/Dashboard.jsx';
import { FamilyPatients } from '../features/family/FamilyPatients.jsx';
import { NotFound } from './NotFound.jsx';

export function FamilyHome() {
  return (
    <>
      <AppHeader />
      <OfflineBanner />
      <main className="mx-auto w-full max-w-md px-4 py-4 pb-16 sm:max-w-2xl">
        <Routes>
          <Route index element={<FamilyPatients />} />
          <Route path="patients/:patientId" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
