import { useState } from 'react';
import { validatePayload } from '../../../lib/entries.js';

/** Validates the time and payload, then calls onSave(value, at). Returns [errors, onSubmit]. */
export function useEntrySubmit(type, getFields, timeField, onSave) {
  const [errors, setErrors] = useState({});
  function onSubmit(event) {
    event.preventDefault();
    const time = timeField.resolve(new Date());
    const result = validatePayload(type, getFields());
    const next = {
      ...(result.ok ? {} : result.errors),
      ...(time.error ? { time: time.error } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length === 0) onSave(result.value, time.at);
  }
  return [errors, onSubmit];
}
