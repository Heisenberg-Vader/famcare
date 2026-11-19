import { Route, Routes } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader.jsx';
import { OfflineBanner } from '../components/OfflineBanner.jsx';
import { NotFound } from './NotFound.jsx';
import { PatientList } from '../features/nurse/PatientList.jsx';
import { TodayLog } from '../features/nurse/TodayLog.jsx';

export function NurseHome() {
  return (
    <>
      <AppHeader />
      <OfflineBanner />
      <main className="mx-auto w-full max-w-md px-4 py-4 pb-24 sm:max-w-2xl">
        <Routes>
          <Route index element={<PatientList />} />
          <Route path="patients/:patientId" element={<TodayLog />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
