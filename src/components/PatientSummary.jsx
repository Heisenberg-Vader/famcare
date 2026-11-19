import { ageFromDob } from '../lib/time.js';

/** Name, age, city and conditions; shared by nurse and family headers. */
export function PatientSummary({ patient, as: Heading = 'h1' }) {
  const age = ageFromDob(patient.dob);
  return (
    <div>
      <Heading className="text-xl font-semibold text-slate-900">{patient.fullName}</Heading>
      <p className="text-sm text-slate-600">
        {[age != null ? `${age} y` : null, patient.gender, patient.city]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {patient.conditions?.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {patient.conditions.map((c) => (
            <li key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
