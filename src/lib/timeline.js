// Builds the rows of a day timeline: logged entries plus scheduled doses that were not
// recorded 2 h after their time. Shared by the nurse today list and the family timeline.
import { describeEntry, vitalParts } from './entryText.js';
import { DEFAULT_RANGES } from './ranges.js';

export function buildTimeline({ entries = [], doses = [], ranges = DEFAULT_RANGES }) {
  const items = entries.map((entry) => ({
    key: entry.id,
    kind: 'entry',
    type: entry.type,
    at: entry.at,
    entry,
    ...describeEntry(entry, ranges),
    parts: entry.type === 'vitals' ? vitalParts(entry, ranges) : null,
  }));
  for (const dose of doses) {
    if (dose.status !== 'not_recorded') continue;
    items.push({
      key: `missing-${dose.key}`,
      kind: 'missing',
      type: 'medication',
      at: dose.scheduledAt,
      dose,
      title: `${dose.medicationName}${dose.strength ? ` ${dose.strength}` : ''} (${dose.scheduledTime}): not recorded`,
      detail: 'No entry 2 hours after the scheduled time',
      tone: 'missing',
      parts: null,
    });
  }
  return items.sort((a, b) => a.at - b.at || String(a.key).localeCompare(String(b.key)));
}
