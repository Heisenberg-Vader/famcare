import { useState } from 'react';
import { ChoiceChips } from '../../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../../components/form/FormActions.jsx';
import { NumberField } from '../../../components/form/NumberField.jsx';
import { TimeInput } from '../../../components/form/TimeInput.jsx';
import { useTimeField } from '../../../hooks/useTimeField.js';
import { useEntrySubmit } from './useEntrySubmit.js';

const PRESETS = [100, 150, 200, 250, 300, 500];

export function WaterForm({ entry, dateKey, onSave, onCancel }) {
  const [ml, setMl] = useState(entry?.ml ?? 250);
  const timeField = useTimeField(dateKey, entry?.at);
  const [errors, onSubmit] = useEntrySubmit('water', () => ({ ml }), timeField, onSave);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ChoiceChips
        label="Amount"
        options={PRESETS.map((v) => ({ value: v, label: `${v} ml` }))}
        value={Number(ml)}
        onChange={setMl}
      />
      <NumberField
        label="Or enter amount"
        unit="ml"
        value={ml}
        onChange={setMl}
        error={errors.ml}
      />
      <TimeInput field={timeField} error={errors.time} />
      <FormActions onCancel={onCancel} />
    </form>
  );
}
