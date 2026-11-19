import { PatientSummary } from '../../components/PatientSummary.jsx';

export function FamilyHeader({ patient }) {
  return (
    <div className="space-y-2">
      <PatientSummary patient={patient} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        {patient.nurses?.length > 0 && (
          <>
            <dt className="text-slate-500">{patient.nurses.length > 1 ? 'Nurses' : 'Nurse'}</dt>
            <dd className="text-slate-800">
              {patient.nurses
                .map((n) => `${n.fullName}${n.shift ? ` (${n.shift.split(' ')[0]})` : ''}`)
                .join(', ')}
            </dd>
          </>
        )}
        {patient.primaryDoctor && (
          <>
            <dt className="text-slate-500">Doctor</dt>
            <dd className="text-slate-800">{patient.primaryDoctor}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
