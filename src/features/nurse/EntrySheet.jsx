import { Sheet } from '../../components/Sheet.jsx';
import { ActivityForm } from './forms/ActivityForm.jsx';
import { MealForm } from './forms/MealForm.jsx';
import { MoodForm } from './forms/MoodForm.jsx';
import { ObservationForm } from './forms/ObservationForm.jsx';
import { VitalsForm } from './forms/VitalsForm.jsx';
import { WaterForm } from './forms/WaterForm.jsx';

const FORMS = {
  vitals: { title: 'Vitals', Form: VitalsForm },
  meal: { title: 'Meal', Form: MealForm },
  water: { title: 'Water', Form: WaterForm },
  activity: { title: 'Activity', Form: ActivityForm },
  mood: { title: 'Mood', Form: MoodForm },
  observation: { title: 'Note', Form: ObservationForm },
};

/** Add (entry null) or edit an entry of `type`. */
export function EntrySheet({ type, entry, dateKey, onSave, onClose }) {
  const { title, Form } = FORMS[type];
  return (
    <Sheet
      title={entry ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}
      onClose={onClose}
    >
      <Form entry={entry} dateKey={entry?.dateKey ?? dateKey} onSave={onSave} onCancel={onClose} />
    </Sheet>
  );
}
