import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext.js';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { PatientSummary } from '../../components/PatientSummary.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { watchMyPatients } from '../../data/patients.js';
import { useSubscription } from '../../hooks/useSubscription.js';

/** Goes straight to the dashboard when the family member follows one patient. */
export function FamilyPatients() {
  const { user } = useAuth();
  const patients = useSubscription(
    (ok, err) => watchMyPatients(user.uid, 'family', ok, err),
    user.uid,
  );

  if (patients.loading) return <Spinner label="Loading" />;
  if (patients.error) return <ErrorState error={patients.error} />;
  if (patients.data.length === 0) {
    return (
      <EmptyState title="No patients linked to your account">
        Contact the care coordinator.
      </EmptyState>
    );
  }
  if (patients.data.length === 1) {
    return <Navigate to={`patients/${patients.data[0].id}`} replace />;
  }
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-brand-700">Family dashboard</h1>
      {patients.data.map((p) => (
        <Link
          key={p.id}
          to={`patients/${p.id}`}
          className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500"
        >
          <PatientSummary patient={p} as="h2" />
        </Link>
      ))}
    </div>
  );
}
