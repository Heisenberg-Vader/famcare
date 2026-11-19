import { canEditEntry, label } from '../../lib/entries.js';
import { formatClock } from '../../lib/time.js';

const STATUS_STYLE = {
  given: 'bg-emerald-100 text-emerald-800',
  missed: 'bg-amber-100 text-amber-800',
  refused: 'bg-amber-100 text-amber-800',
  held: 'bg-amber-100 text-amber-800',
  not_recorded: 'bg-red-100 text-red-800',
  pending: 'bg-slate-100 text-slate-600',
};

const ACTIONS = [
  { status: 'given', text: 'Given', active: 'bg-emerald-600 text-white border-emerald-600' },
  { status: 'missed', text: 'Missed', active: 'bg-amber-500 text-white border-amber-500' },
  { status: 'refused', text: 'Refused', active: 'bg-amber-500 text-white border-amber-500' },
];

function statusText(dose) {
  if (dose.status === 'not_recorded') return 'Not recorded';
  if (dose.status === 'pending') return `Due ${formatClock(dose.scheduledTime)}`;
  return label(dose.status);
}

/**
 * Today's doses grouped by slot. onMark(dose, status) handles one-tap Given and the reason
 * prompt for the other statuses.
 */
export function MedChecklist({ groups, uid, now, onMark }) {
  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">No medicines scheduled today.</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.slot}>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {group.slot}
          </h3>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {group.doses.map((dose) => {
              const editable = !dose.entry || canEditEntry(dose.entry, uid, now);
              return (
                <li key={dose.key} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {dose.medicationName}{' '}
                        <span className="font-normal text-slate-500">{dose.strength}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatClock(dose.scheduledTime)} · {dose.dose}
                        {dose.instructions ? ` · ${dose.instructions}` : ''}
                      </p>
                      {dose.entry?.reason && (
                        <p className="mt-0.5 text-sm text-amber-800">{dose.entry.reason}</p>
                      )}
                      {dose.entry && !editable && (
                        <p className="mt-0.5 text-xs text-slate-400">by {dose.entry.nurseName}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[dose.status]}`}
                    >
                      {statusText(dose)}
                      {dose.entry?.pending ? ' · sync' : ''}
                    </span>
                  </div>
                  {editable && (
                    <div
                      className="mt-2 grid grid-cols-3 gap-2"
                      role="group"
                      aria-label={`Mark ${dose.medicationName} ${dose.scheduledTime}`}
                    >
                      {ACTIONS.map((a) => {
                        const current = dose.entry?.status === a.status;
                        return (
                          <button
                            key={a.status}
                            type="button"
                            aria-pressed={current}
                            onClick={() => !current && onMark(dose, a.status)}
                            className={`min-h-11 rounded-lg border text-sm font-medium ${
                              current
                                ? a.active
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {a.text}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
