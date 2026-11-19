# CarePal Daily Care

Nurses log a patient's day on a phone; families see it as a timeline, vitals charts and a
30-day PDF report. Built with React + Vite, Tailwind, Firebase Auth and Cloud Firestore.

Full setup, architecture and decisions are written up in the final phase. For now:

1. Copy `.env.example` to `.env` and fill in the Firebase web config and the service-account path.
2. `npm install`
3. `npm run dev`
4. `npm run check` runs lint, unit tests and the production build.
5. `npm run test:rules` runs the Firestore rules tests in the emulator (needs Java 11+).
6. `npm run deploy` runs the full check, then deploys Hosting, Firestore rules and indexes
   (uses the Firebase CLI login on this machine).

## Data on devices

Care records are health data. The rule is: **nothing about a patient stays on a device after
sign-out, and a nurse's device holds as little as it needs to work offline.** Security is
not traded for speed.

### What is stored where

| Who    | Firestore cache                    | Why                                                                                |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------- |
| Nurse  | `persistentLocalCache` (IndexedDB) | Logging must keep working without signal; queued writes survive a reload.          |
| Family | `memoryLocalCache`                 | Families only read; nothing is written to disk and it is gone when the tab closes. |

Firestore is not created when the app loads. `src/lib/firebase.js` creates it in
`initDb(role)` only after Firebase Auth has returned the user's role claim, so the cache type
always matches the role.

### What a nurse device can fetch

Nurse queries cover **today and yesterday (IST) only** (`src/lib/scope.js`,
`nurseEntriesQuery` in `src/data/entries.js`). This is also enforced on the server:
`firestore.rules` lets a nurse read an entry only if its `at` is within the last 50 hours
(start of yesterday at any time today, plus clock skew), so even a modified client cannot pull
older history onto the device. Families can read the full history of their own patient.

### Secure sign-out (`src/auth/secureSignOut.js`)

1. Wait up to **8 seconds** for queued writes to reach the server (`waitForPendingWrites`).
2. If they do not sync, stop and show a dialog with the number of unsynced entries (counted
   from `hasPendingWrites` on today's and yesterday's cached entries). The nurse can retry, stay
   signed in, or tick "I understand these entries will be permanently lost" and choose
   **Sign out and discard**.
3. `terminate()` Firestore, then `clearIndexedDbPersistence()` to delete the on-disk cache.
4. Firebase Auth `signOut()`, clear the session flags, and do a full page reload so no copy of
   patient data survives in memory.

While signing out, the dialog replaces the whole app, so patient data is not left on screen.

If the wipe fails (for example another CarePal tab still holds the database), the user is
still signed out and told to close other tabs. A `carepal.wipePending` flag makes the app
finish the wipe on its next start, before any data is loaded. Signing out in one tab wipes and
reloads the other tabs too.

### Idle auto sign-out (nurse routes)

After **30 minutes** without a tap, key press or scroll, the same secure sign-out runs.
Activity is compared by wall-clock time and shared across tabs, so a phone that slept through
the timeout, or an app reopened hours later, signs out on wake. If entries are unsynced at
that moment there is **no "stay signed in"** option, because the device is unattended: the app
covers the screen, retries every 20 seconds and finishes the sign-out as soon as the entries
sync, or the nurse can confirm discarding them.

### Service worker

The PWA service worker (`pwa.config.js`, vite-plugin-pwa) precaches only the built app shell
(JS, CSS, HTML, icons). `runtimeCaching` is empty: it never caches requests to
`googleapis.com` or other Firebase hosts, because those responses carry patient data and
tokens and a service-worker cache would outlive sign-out. A unit test
(`src/lib/pwaConfig.test.js`) guards this. The family-only chart and PDF chunks (about
1.2 MB) are left out of the precache and download on first use, so installing on a nurse
phone fetches about 1 MB.

### What is kept in `localStorage`

Only non-sensitive flags, never patient data: the last role per user ID (so a nurse whose
token expires while offline can keep logging; the server still checks the real claim when
writes sync), the last-activity time for the idle timer, and the wipe-pending flag. Session
flags are removed on sign-out.

### Known limits

- Unsynced offline entries discarded at sign-out are lost. This is deliberate: the
  alternative is leaving them on an unattended device.
- Firebase Auth keeps the signed-in session in IndexedDB until sign-out (that is what keeps a
  nurse signed in across reloads). The idle timeout limits how long an unattended, signed-in
  device stays usable.
- A nurse device whose clock runs more than about 2 hours slow cannot load yesterday's
  entries (the server-side window is computed from server time).
