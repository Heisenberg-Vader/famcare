import { useState } from 'react';
import { ChoiceChips } from '../../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../../components/form/FormActions.jsx';
import { NumberField } from '../../../components/form/NumberField.jsx';
import { TimeInput } from '../../../components/form/TimeInput.jsx';
import { useTimeField } from '../../../hooks/useTimeField.js';
import { SUGAR_CONTEXTS, VITAL_KEYS, VITAL_LIMITS, label } from '../../../lib/entries.js';
import { METRICS } from '../../../lib/ranges.js';
import { useEntrySubmit } from './useEntrySubmit.js';

const FIELDS = [
  ['systolic', 'Systolic'],
  ['diastolic', 'Diastolic'],
  ['pulse', 'Pulse'],
  ['spo2', 'SpO2'],
  ['tempF', 'Temperature'],
  ['weightKg', 'Weight'],
];

export function VitalsForm({ entry, dateKey, onSave, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(VITAL_KEYS.map((k) => [k, entry?.[k] ?? ''])),
  );
  const [sugarContext, setSugarContext] = useState(entry?.sugarContext ?? 'random');
  const timeField = useTimeField(dateKey, entry?.at);
  const [errors, onSubmit] = useEntrySubmit(
    'vitals',
    () => ({ ...values, sugarContext }),
    timeField,
    onSave,
  );
  const set = (key) => (v) => setValues((s) => ({ ...s, [key]: v }));
  const field = (key, text) => (
    <NumberField
      key={key}
      label={text}
      unit={METRICS[key].unit}
      step={VITAL_LIMITS[key].step}
      value={values[key]}
      onChange={set(key)}
      error={errors[key]}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm text-slate-500">Fill in only what you measured.</p>
      <div className="grid grid-cols-2 gap-3">{FIELDS.map(([k, t]) => field(k, t))}</div>
      {field('sugar', 'Blood sugar')}
      {values.sugar !== '' && (
        <ChoiceChips
          label="Sugar taken"
          options={SUGAR_CONTEXTS.map((v) => ({ value: v, label: label(v) }))}
          value={sugarContext}
          onChange={setSugarContext}
          error={errors.sugarContext}
        />
      )}
      <TimeInput field={timeField} error={errors.time} />
      <FormActions onCancel={onCancel} error={errors.form} />
    </form>
  );
}
