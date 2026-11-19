import { useState } from 'react';
import { ChoiceChips } from '../../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../../components/form/FormActions.jsx';
import { NumberField } from '../../../components/form/NumberField.jsx';
import { TextAreaField } from '../../../components/form/TextAreaField.jsx';
import { TimeInput } from '../../../components/form/TimeInput.jsx';
import { useTimeField } from '../../../hooks/useTimeField.js';
import { ACTIVITY_KINDS, label } from '../../../lib/entries.js';
import { useEntrySubmit } from './useEntrySubmit.js';

export function ActivityForm({ entry, dateKey, onSave, onCancel }) {
  const [kind, setKind] = useState(entry?.kind ?? 'walk');
  const [durationMin, setDuration] = useState(entry?.durationMin ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const timeField = useTimeField(dateKey, entry?.at);
  const [errors, onSubmit] = useEntrySubmit(
    'activity',
    () => ({ kind, durationMin, notes }),
    timeField,
    onSave,
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ChoiceChips
        label="Activity"
        options={ACTIVITY_KINDS.map((v) => ({ value: v, label: label(v) }))}
        value={kind}
        onChange={setKind}
        error={errors.kind}
      />
      <NumberField
        label="Duration"
        unit="min"
        value={durationMin}
        onChange={setDuration}
        error={errors.durationMin}
      />
      <TextAreaField
        label="Notes (optional)"
        rows={2}
        value={notes}
        onChange={setNotes}
        error={errors.notes}
      />
      <TimeInput field={timeField} error={errors.time} />
      <FormActions onCancel={onCancel} />
    </form>
  );
}
