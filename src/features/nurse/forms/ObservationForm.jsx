import { useState } from 'react';
import { ChoiceChips } from '../../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../../components/form/FormActions.jsx';
import { TextAreaField } from '../../../components/form/TextAreaField.jsx';
import { TimeInput } from '../../../components/form/TimeInput.jsx';
import { useTimeField } from '../../../hooks/useTimeField.js';
import { useEntrySubmit } from './useEntrySubmit.js';

export function ObservationForm({ entry, dateKey, onSave, onCancel }) {
  const [text, setText] = useState(entry?.text ?? '');
  const [severity, setSeverity] = useState(entry?.severity ?? 'info');
  const timeField = useTimeField(dateKey, entry?.at);
  const [errors, onSubmit] = useEntrySubmit(
    'observation',
    () => ({ text, severity }),
    timeField,
    onSave,
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <TextAreaField
        label="Observation"
        rows={4}
        value={text}
        onChange={setText}
        error={errors.text}
      />
      <ChoiceChips
        label="Type"
        options={[
          { value: 'info', label: 'Info' },
          { value: 'concern', label: '⚠️ Concern' },
        ]}
        value={severity}
        onChange={setSeverity}
        error={errors.severity}
      />
      {severity === 'concern' && (
        <p className="text-sm text-amber-800">
          Concerns are highlighted for the family and in the report.
        </p>
      )}
      <TimeInput field={timeField} error={errors.time} />
      <FormActions onCancel={onCancel} />
    </form>
  );
}
