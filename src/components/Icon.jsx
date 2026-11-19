// The app's icon set: 24px line icons drawn with currentColor, so they take the text colour
// of their context (brand, red for alerts, amber for warnings). Replaces emoji, which render
// differently on every phone and can't be recoloured.
const dot = (cx, cy) => <circle cx={cx} cy={cy} r="1.1" fill="currentColor" stroke="none" />;
const face = (mouth) => (
  <>
    <circle cx="12" cy="12" r="9" />
    {dot(9, 9.75)}
    {dot(15, 9.75)}
    {mouth}
  </>
);

const ICONS = {
  vitals: (
    <>
      <path d="M5 3h2M13 3h2" />
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M10 12v3a5 5 0 0 0 10 0v-1.5" />
      <circle cx="20" cy="11.5" r="2" />
    </>
  ),
  meal: (
    <>
      <path d="M5 3v6a3 3 0 0 0 6 0V3" />
      <path d="M8 3v18" />
      <path d="M17 21V3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5" />
    </>
  ),
  water: <path d="M12 3.5c-3 4-5.5 7-5.5 10a5.5 5.5 0 0 0 11 0c0-3-2.5-6-5.5-10z" />,
  medication: (
    <>
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="m9.9 9.9 4.2 4.2" />
    </>
  ),
  activity: (
    <>
      <circle cx="13.5" cy="4.5" r="1.75" />
      <path d="m8 11 3.5-3 2.5 2.5 3 .5" />
      <path d="m11.5 8-1.5 6 3 3v4" />
      <path d="m10 14-2.5 7" />
    </>
  ),
  mood: face(<path d="M8.5 14c1.5 1.6 5.5 1.6 7 0" />),
  observation: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),
  mood1: face(<path d="M7.5 17c2-2.8 7-2.8 9 0" />),
  mood2: face(<path d="M8.5 16c1.6-1.3 5.4-1.3 7 0" />),
  mood3: face(<path d="M9 15h6" />),
  mood4: face(<path d="M8.5 14c1.5 1.6 5.5 1.6 7 0" />),
  mood5: face(<path d="M7.5 13.5h9a4.5 4.5 0 0 1-9 0z" />),
  warning: (
    <>
      <path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4" />
      {dot(12, 17)}
    </>
  ),
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
};

/** <Icon name="water" />. Decorative (aria-hidden) unless a `label` is given. */
export function Icon({ name, size = 20, strokeWidth = 1.75, label, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {ICONS[name] ?? ICONS.dot}
    </svg>
  );
}
