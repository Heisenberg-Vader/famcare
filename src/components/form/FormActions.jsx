import { Button } from '../Button.jsx';

export function FormActions({ onCancel, submitLabel = 'Save', error }) {
  return (
    <div className="space-y-2 pt-2">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </div>
  );
}
