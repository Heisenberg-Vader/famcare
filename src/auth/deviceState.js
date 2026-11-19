// Small, non-sensitive per-device flags kept in localStorage. No patient data is stored here.
// Every access is wrapped: storage can be unavailable (private mode, blocked site data).
const KEYS = {
  roleHint: 'carepal.roleHint', // { uid, role } so an offline nurse with an expired token keeps working
  lastActivity: 'carepal.lastActivity', // epoch ms of the last user interaction (idle sign-out)
  wipePending: 'carepal.wipePending', // set before wiping IndexedDB, cleared when the wipe succeeds
};

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the in-memory behaviour still applies
  }
}

export function readRoleHint(uid) {
  try {
    const hint = JSON.parse(read(KEYS.roleHint) ?? 'null');
    return hint?.uid === uid && hint.role === 'nurse' ? 'nurse' : null;
  } catch {
    return null;
  }
}

export function writeRoleHint(uid, role) {
  write(KEYS.roleHint, JSON.stringify({ uid, role }));
}

export function readLastActivity() {
  const n = Number(read(KEYS.lastActivity));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function markActivity(at = Date.now()) {
  write(KEYS.lastActivity, String(at));
}

export function isWipePending() {
  return read(KEYS.wipePending) === '1';
}

export function setWipePending(pending) {
  write(KEYS.wipePending, pending ? '1' : null);
}

/** Removes the session flags (not the wipe flag, which is owned by the wipe itself). */
export function clearSessionState() {
  write(KEYS.roleHint, null);
  write(KEYS.lastActivity, null);
}
