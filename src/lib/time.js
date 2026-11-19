// IST date helpers. Every dateKey in the app is computed here so that entries logged
// between 00:00 and 05:30 IST land on the right local day (UTC would put them on the previous day).
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const TZ = 'Asia/Kolkata';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Accepts a Date, a Firestore Timestamp, epoch millis or an ISO string and returns a Date. */
export function toDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number' || typeof value === 'string') return new Date(value);
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
}

export function isDateKey(value) {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

/** IST local date of `date` as 'YYYY-MM-DD'. */
export function toDateKey(date = new Date()) {
  return formatInTimeZone(toDate(date), TZ, 'yyyy-MM-dd');
}

export function todayKey(now = new Date()) {
  return toDateKey(now);
}

/** The instant that is `HH:mm` IST on `dateKey`. */
export function atIST(dateKey, time = '00:00') {
  if (!isDateKey(dateKey)) throw new Error(`Invalid dateKey: ${dateKey}`);
  if (!TIME_RE.test(time)) throw new Error(`Invalid time: ${time}`);
  return fromZonedTime(`${dateKey}T${time}:00`, TZ);
}

/** Half-open range [start, end) covering the IST day `dateKey`. */
export function dayRange(dateKey) {
  const start = atIST(dateKey, '00:00');
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Calendar arithmetic on date keys (timezone independent). */
export function addDaysToKey(dateKey, days) {
  if (!isDateKey(dateKey)) throw new Error(`Invalid dateKey: ${dateKey}`);
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** Inclusive list of date keys from startKey to endKey. */
export function dateKeysBetween(startKey, endKey) {
  const keys = [];
  for (let k = startKey; k <= endKey; k = addDaysToKey(k, 1)) keys.push(k);
  return keys;
}

/** The `days` date keys ending on (and including) endKey. */
export function lastNDays(endKey, days) {
  return dateKeysBetween(addDaysToKey(endKey, -(days - 1)), endKey);
}

/** 'HH:mm' in IST for an instant. */
export function toTimeString(date) {
  return formatInTimeZone(toDate(date), TZ, 'HH:mm');
}

/** '8:05 AM' in IST. */
export function formatTime(date) {
  return formatInTimeZone(toDate(date), TZ, 'h:mm a');
}

/** Formats an instant in IST with a date-fns pattern. */
export function formatIST(date, pattern = 'd MMM yyyy, h:mm a') {
  return formatInTimeZone(toDate(date), TZ, pattern);
}

/** Formats a dateKey (e.g. 'EEE, d MMM'). Uses IST noon so the day never shifts. */
export function formatDateKey(dateKey, pattern = 'EEE, d MMM yyyy') {
  return formatInTimeZone(atIST(dateKey, '12:00'), TZ, pattern);
}

/** '08:00' -> '8:00 AM' without involving a date. */
export function formatClock(time) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Whole years between dob (dateKey) and the IST date of `now`. */
export function ageFromDob(dob, now = new Date()) {
  if (!isDateKey(dob)) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = toDateKey(now).split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
