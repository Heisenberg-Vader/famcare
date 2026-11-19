import { EntryIcon } from '../../components/EntryIcon.jsx';
import { formatTime } from '../../lib/time.js';

const TITLE_TONE = {
  alert: 'text-red-700',
  warn: 'text-amber-700',
  missing: 'text-slate-500 italic',
  normal: 'text-slate-900',
};

function Detail({ item }) {
  if (item.parts) {
    return (
      <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {item.parts.map((p) => (
          <span key={p.key} className={p.flag ? 'font-semibold text-red-700' : 'text-slate-600'}>
            {p.text}
            {p.flag && <span className="sr-only"> ({p.flag})</span>}
            {p.flag === 'high' && ' ↑'}
            {p.flag === 'low' && ' ↓'}
          </span>
        ))}
      </p>
    );
  }
  return item.detail ? <p className="mt-0.5 text-sm text-slate-600">{item.detail}</p> : null;
}

/**
 * Day timeline. items come from lib/timeline.buildTimeline.
 * canSelect(entry) and onSelect(item) make own, still-editable rows tappable.
 */
export function Timeline({ items, canSelect, onSelect }) {
  return (
    <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((item) => {
        const selectable = item.kind === 'entry' && onSelect && canSelect?.(item.entry);
        const body = (
          <>
            <span className="w-16 shrink-0 pt-2 text-xs text-slate-500 tabular-nums">
              {formatTime(item.at)}
            </span>
            <EntryIcon type={item.type} tone={item.tone} />
            <div className="min-w-0 flex-1 pt-1">
              <p className={`text-sm font-medium ${TITLE_TONE[item.tone] ?? TITLE_TONE.normal}`}>
                {item.title}
              </p>
              <Detail item={item} />
              {item.kind === 'entry' && (
                <p className="mt-0.5 text-xs text-slate-400">
                  {item.entry.nurseName}
                  {item.entry.pending && (
                    <span className="ml-2 text-amber-700">· waiting to sync</span>
                  )}
                  {selectable && <span className="ml-2 text-brand-600">· tap to edit</span>}
                </p>
              )}
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {selectable ? (
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                {body}
              </button>
            ) : (
              <div className="flex gap-3 px-3 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
