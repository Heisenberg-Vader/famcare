export const HOME_BY_ROLE = Object.freeze({ nurse: '/nurse', family: '/family' });

export function homePathFor(role) {
  return HOME_BY_ROLE[role] ?? '/login';
}

/** True when `path` belongs to the area of `role` (used to honour redirect-after-login). */
export function pathAllowedFor(role, path) {
  const home = HOME_BY_ROLE[role];
  return Boolean(
    home && typeof path === 'string' && (path === home || path.startsWith(`${home}/`)),
  );
}

export const DEMO_PASSWORD = 'CarePal@123';

export const DEMO_ACCOUNTS = Object.freeze({
  nurse: { label: 'Use demo nurse', email: 'nurse.anita@demo.carepal.test' },
  family: { label: 'Use demo family', email: 'family.priya@demo.carepal.test' },
});
