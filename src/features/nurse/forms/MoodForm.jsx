import { useState } from 'react';
import { ChoiceChips } from '../../../components/form/ChoiceChips.jsx';
import { FormActions } from '../../../components/form/FormActions.jsx';
import { TimeInput } from '../../../components/form/TimeInput.jsx';
import { useTimeField } from '../../../hooks/useTimeField.js';
import { MOOD_TAGS } from '../../../lib/entries.js';
import { moodWord } from '../../../lib/entryText.js';
import { Icon } from '../../../components/Icon.jsx';
import { useEntrySubmit } from './useEntrySubmit.js';

export function MoodForm({ entry, dateKey, onSave, onCancel }) {
  const [score, setScore] = useState(entry?.score ?? null);
  const [tags, setTags] = useState(entry?.tags ?? []);
  const timeField = useTimeField(dateKey, entry?.at);
  const [errors, onSubmit] = useEntrySubmit('mood', () => ({ score, tags }), timeField, onSave);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <ChoiceChips
        label="Overall mood"
        options={[1, 2, 3, 4, 5].map((v) => ({
          value: v,
          label: (
            <>
              <Icon name={`mood${v}`} size={18} />
              {moodWord(v)}
            </>
          ),
        }))}
        value={score}
        onChange={setScore}
        error={errors.score}
      />
      <ChoiceChips
        label="How they seemed (optional)"
        multiple
        options={MOOD_TAGS.map((v) => ({ value: v, label: v }))}
        value={tags}
        onChange={setTags}
        error={errors.tags}
      />
      <TimeInput field={timeField} error={errors.time} />
      <FormActions onCancel={onCancel} />
    </form>
  );
}
