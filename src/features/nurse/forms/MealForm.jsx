import { useState } from 'react';
import { ChoiceChips } from '../../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../../components/form/FormActions.jsx';
import { TextAreaField } from '../../../components/form/TextAreaField.jsx';
import { TimeInput } from '../../../components/form/TimeInput.jsx';
import { useTimeField } from '../../../hooks/useTimeField.js';
import {
  MEAL_SLOTS,
  PORTIONS,
  PORTION_LABELS,
  defaultMealSlot,
  label,
} from '../../../lib/entries.js';
import { useEntrySubmit } from './useEntrySubmit.js';

export function MealForm({ entry, dateKey, onSave, onCancel }) {
  const [slot, setSlot] = useState(entry?.slot ?? defaultMealSlot());
  const [items, setItems] = useState(entry?.items ?? '');
  const [portion, setPortion] = useState(entry?.portion ?? 1);
  const timeField = useTimeField(dateKey, entry?.at);
  const [errors, onSubmit] = useEntrySubmit(
    'meal',
    () => ({ slot, items, portion }),
    timeField,
    onSave,
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ChoiceChips
        label="Meal"
        options={MEAL_SLOTS.map((v) => ({ value: v, label: label(v) }))}
        value={slot}
        onChange={setSlot}
        error={errors.slot}
      />
      <TextAreaField
        label="What was served"
        rows={2}
        value={items}
        onChange={setItems}
        error={errors.items}
        placeholder="e.g. 2 rotis, dal, sabzi"
      />
      <ChoiceChips
        label="How much was eaten"
        options={PORTIONS.map((v) => ({ value: v, label: PORTION_LABELS[v] }))}
        value={portion}
        onChange={setPortion}
        error={errors.portion}
      />
      <TimeInput field={timeField} error={errors.time} />
      <FormActions onCancel={onCancel} />
    </form>
  );
}
