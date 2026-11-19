import { useAuth } from '../../auth/authContext.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { watchMyPatients } from '../../data/patients.js';
import { useNow } from '../../hooks/useNow.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { PatientCard } from './PatientCard.jsx';

export function PatientList() {
  const { user } = useAuth();
  const now = useNow();
  const patients = useSubscription(
    (ok, err) => watchMyPatients(user.uid, 'nurse', ok, err),
    user.uid,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-brand-700">My patients</h1>
      {patients.loading && <Spinner label="Loading patients" />}
      {patients.error && <ErrorState error={patients.error} />}
      {patients.data?.length === 0 && (
        <EmptyState title="No patients assigned">
          Ask your coordinator to assign patients.
        </EmptyState>
      )}
      {patients.data?.map((p) => (
        <PatientCard key={p.id} patient={p} now={now} />
      ))}
    </div>
  );
}
