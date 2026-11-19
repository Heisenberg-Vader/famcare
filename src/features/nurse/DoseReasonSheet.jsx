import { useState } from 'react';
import { Sheet } from '../../components/Sheet.jsx';
import { ChoiceChips } from '../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../components/form/FormActions.jsx';
import { TextAreaField } from '../../components/form/TextAreaField.jsx';
import { label } from '../../lib/entries.js';
import { formatClock } from '../../lib/time.js';

const QUICK_REASONS = {
  missed: ['Patient asleep', 'Medicine out of stock', 'Patient away from home', 'Forgot'],
  refused: ['Refused to take it', 'Spat it out', 'Nausea or vomiting', 'Too agitated'],
  held: ['Held on doctor advice', 'Reading out of range', 'Nil by mouth'],
};

/** Reason prompt for a dose that was not given. */
export function DoseReasonSheet({ dose, status, onSave, onClose }) {
  const [reason, setReason] = useState(
    dose.entry?.status === status ? (dose.entry.reason ?? '') : '',
  );
  const [error, setError] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Give a reason');
      return;
    }
    onSave(reason.trim());
  }

  return (
    <Sheet title={`${label(status)}: ${dose.medicationName}`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="text-sm text-slate-600">
          {dose.strength} · {dose.dose} · scheduled {formatClock(dose.scheduledTime)}
        </p>
        <ChoiceChips
          label="Reason"
          options={(QUICK_REASONS[status] ?? []).map((r) => ({ value: r, label: r }))}
          value={reason}
          onChange={setReason}
        />
        <TextAreaField label="Details" rows={2} value={reason} onChange={setReason} error={error} />
        <FormActions onCancel={onClose} submitLabel={`Mark ${label(status).toLowerCase()}`} />
      </form>
    </Sheet>
  );
}
