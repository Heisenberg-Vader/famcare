// What a nurse's device is allowed to fetch: today and yesterday only (IST).
// Firestore rules enforce the same window server-side (entries `at` within 50 hours).
import { addDaysToKey, dayRange, todayKey } from './time.js';

export const NURSE_WINDOW_DAYS = 2;

/** { dateKeys: [yesterday, today], since: start of yesterday IST } */
export function nurseWindow(now = new Date()) {
  const today = todayKey(now);
  const yesterday = addDaysToKey(today, -(NURSE_WINDOW_DAYS - 1));
  return { dateKeys: [yesterday, today], since: dayRange(yesterday).start };
}

export function isInNurseWindow(dateKey, now = new Date()) {
  return nurseWindow(now).dateKeys.includes(dateKey);
}
