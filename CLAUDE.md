# CarePal Daily Care: build spec (TheCarePal FS-03)

This file is the source of truth for this repo. Read it fully before writing code.
Work one phase at a time. After each phase: `npm run build` must pass, then commit.

## 1. Product in one paragraph

Nurses log a patient's day on a phone: vitals, meals, water, medicine doses, activities,
mood and observations. Families (often in another city) open a dashboard that shows the
day as a timeline, vital charts with normal bands, a weekly summary and a 30-day PDF they
can take to a doctor. Each role sees only its own patients.

## 2. Stack (fixed, do not swap)

| Concern | Choice |
|---|---|
| Frontend | React 18 + Vite, JavaScript (ES modules), react-router v6 |
| Styling | Tailwind CSS, mobile-first (design at 375px, then widen) |
| Auth | Firebase Auth, email/password. Role in a **custom claim** `role: 'nurse' \| 'family'` |
| Database | Cloud Firestore, region `asia-south1` |
| Hosting | Firebase Hosting (Spark plan) |
| Dates | date-fns + date-fns-tz. All display in `Asia/Kolkata` |
| Charts | recharts (`ReferenceArea` for normal bands) |
| Calendar | react-day-picker |
| PDF | jspdf + jspdf-autotable, charts captured with html-to-image |
| Offline | Firestore `persistentLocalCache` + vite-plugin-pwa |
| Seed | Node script with firebase-admin (runs locally only) |

No Express server for core features. Firestore Security Rules do the access control.
Server code exists only for: seeding (local script) and email alerts (bonus, see section 9).

## 3. Folder layout

```
/
├─ CLAUDE.md
├─ README.md
├─ .env.example            # VITE_FIREBASE_* keys, no values
├─ firebase.json
├─ firestore.rules
├─ firestore.indexes.json
├─ scripts/
│  └─ seed.mjs             # firebase-admin; reads GOOGLE_APPLICATION_CREDENTIALS
├─ functions/              # bonus only (email alerts), needs Blaze
└─ src/
   ├─ main.jsx, App.jsx
   ├─ lib/
   │  ├─ firebase.js       # init app, auth, firestore with persistent cache
   │  ├─ time.js           # IST helpers: toDateKey(date), dayRange(dateKey), formatTime
   │  ├─ ranges.js         # DEFAULT_RANGES, getRanges(patient), classify(metric, value)
   │  ├─ summaries.js      # pure functions: adherence, mealsCompleted, activityMinutes, moodTrend
   │  └─ schedule.js       # expand medication schedule into expected doses for a date range
   ├─ data/                # Firestore access, one file per collection
   │  ├─ patients.js
   │  ├─ entries.js
   │  └─ medications.js
   ├─ auth/
   │  ├─ AuthProvider.jsx  # user + role from getIdTokenResult()
   │  └─ RequireRole.jsx
   ├─ components/          # shared UI: Card, Button, EntryIcon, EmptyState, OfflineBanner
   ├─ features/
   │  ├─ nurse/            # PatientList, TodayLog, forms/*Form.jsx, MedChecklist
   │  ├─ family/           # Dashboard, Timeline, DayPicker, VitalsCharts, WeeklySummary
   │  └─ report/           # buildReport.js (PDF)
   └─ pages/               # Login, NurseHome, FamilyHome, NotFound
```

Rules: components never import firebase directly; they call `src/data/*`.
All range and summary logic lives in `src/lib` as pure functions so charts, summaries,
PDF and alerts share one implementation.

## 4. Data model (Firestore)

```
users/{uid}
  fullName, phone, email, role ('nurse'|'family'), patientIds: string[]

patients/{patientId}
  fullName, dob, gender, city, conditions: string[], primaryDoctor,
  nurseIds: string[], familyIds: string[],
  rangeOverrides?: { spo2?: {min,max}, sugarFasting?: {min,max}, ... }

patients/{patientId}/medications/{medId}
  name, strength ("500 mg"), dose ("1 tablet"), route ("oral"), instructions,
  times: string[]  // "08:00", "20:00" in IST
  startDate, endDate|null (dateKey strings), active: bool

patients/{patientId}/entries/{entryId}
  type: 'vitals'|'meal'|'water'|'medication'|'activity'|'mood'|'observation'
  at: Timestamp          // when it happened (nurse can backdate within today)
  dateKey: 'YYYY-MM-DD'  // IST local date of `at`. Always computed via lib/time.js
  nurseId, nurseName
  createdAt, updatedAt: serverTimestamp()
  photoUrls?: string[]   // bonus
  ...payload by type (below)
```

Payloads:

- `vitals`: `systolic, diastolic, pulse, spo2, sugar, sugarContext ('fasting'|'post_meal'|'random'), tempF, weightKg`. All optional; at least one required.
- `meal`: `slot ('breakfast'|'lunch'|'snack'|'dinner'), items (string), portion (0|0.25|0.5|0.75|1)`.
- `water`: `ml`.
- `medication`: `medicationId, medicationName, scheduledTime ('08:00'), status ('given'|'missed'|'refused'|'held'), reason?`.
- `activity`: `kind ('walk'|'exercise'|'physio'|'outing'|'other'), durationMin, notes?`.
- `mood`: `score (1..5), tags: string[]` from `calm, cheerful, anxious, agitated, confused, withdrawn, sleepy, tearful`.
- `observation`: `text, severity ('info'|'concern')`.

Indexes (`firestore.indexes.json`): `entries` on `(dateKey ASC, at ASC)` and `(type ASC, at ASC)`.

## 5. Normal ranges (`src/lib/ranges.js`)

Defaults for adults, overridable per patient via `rangeOverrides`. Shown as bands on charts.
Label in UI and README as "reference ranges, configurable; not clinical advice".

| Metric | Unit | Normal band |
|---|---|---|
| Systolic | mmHg | 90 to 140 |
| Diastolic | mmHg | 60 to 90 |
| Pulse | bpm | 60 to 100 |
| SpO2 | % | 95 to 100 |
| Sugar, fasting | mg/dL | 70 to 130 |
| Sugar, post_meal / random | mg/dL | 70 to 180 |
| Temperature | °F | 97.0 to 99.5 |
| Weight | kg | no band; flag change > 2 kg vs 7 days earlier |

`classify(metric, value, ctx) -> 'low'|'normal'|'high'`.

## 6. Access rules (`firestore.rules`)

- Role comes from `request.auth.token.role`.
- `isNurseOf(pid)`: role nurse and `uid in patients/{pid}.nurseIds`.
- `isFamilyOf(pid)`: role family and `uid in patients/{pid}.familyIds`.
- `users/{uid}`: read own doc only. No client writes.
- `patients/{pid}`: read if nurse or family of pid. No client writes.
- `medications`: read if nurse or family of pid. No client writes (seeded).
- `entries`:
  - read: nurse or family of pid.
  - create: nurse of pid, `request.resource.data.nurseId == request.auth.uid`, `type` in allowed list, `dateKey` is a string.
  - update: same nurse who created it, within 12 hours of `createdAt`, cannot change `nurseId`, `type`, `createdAt`.
  - delete: never (care records are append-only; corrections are edits).
- Patient list queries must filter with `where('nurseIds','array-contains',uid)` or `familyIds`, because rules are not filters.

## 7. Screens

**Login**: email/password, plus two "Use demo nurse / demo family" buttons that fill credentials. Redirect by role.

**Nurse (phone-first)**
1. Patient list (assigned patients only) with today's progress chips (vitals done, doses given x/y).
2. Today log for a patient:
   - Medicine checklist grouped by slot (Morning / Afternoon / Evening / Night), built from `schedule.js`. Each dose: Given / Missed / Refused buttons, one tap, reason prompt for non-given.
   - Quick-add buttons: Vitals, Meal, Water (+250 ml one-tap), Activity, Mood, Note. Each opens a short sheet form; time defaults to now, editable.
   - Today's entries list (same Timeline component as family), own entries editable within 12 h.
   - Offline banner when `navigator.onLine` is false; saves show "Saved, will sync".
   - Do **not** `await` Firestore writes before showing success (they never resolve offline). Create the doc ref with `doc(collection(...))`, call `setDoc` and handle errors via `.catch`.

**Family**
1. Header: patient name, age, conditions, assigned nurse(s).
2. Day view: react-day-picker (dots on days with any out-of-range or missed dose), prev/next day arrows, "Today" button. Today uses `onSnapshot`; past days use `getDocs`.
3. Timeline: all entries of the day by `at`, icon per type, out-of-range values in red, missed doses in amber, "not recorded" for scheduled doses with no entry 2 h after their time.
4. Vitals tab: one chart per metric, 7D / 30D toggle, normal band shaded, out-of-range dots red, BP chart shows systolic and diastolic together.
5. Weekly summary card (last 7 days vs previous 7):
   - Medicine adherence % = given / expected doses (from schedule). Show not-recorded separately.
   - Meals completed = main meals with portion ≥ 0.75 / expected main meals (3 per day).
   - Activity minutes total, and per-day bar.
   - Mood trend = daily average score sparkline + up/down/flat arrow.
   - Average water per day.
6. "Download 30-day report" button.

**PDF report (client-side)**
Patient header and date range, generated-at time, weekly-style summary for 30 days,
vitals table (min / max / average / count out of range per metric), the chart images,
adherence per medicine, list of out-of-range readings and missed doses with times,
nurse observations marked "concern", condensed daily log. Footer disclaimer:
"Compiled from caregiver logs. Not a diagnostic document."

## 8. Seed data (`scripts/seed.mjs`)

- Deterministic PRNG (fixed seed) so reruns give the same data. Script is idempotent: deletes and recreates demo docs.
- Creates Auth users with passwords and sets custom claims.
- 2 patients:
  - Kamla Devi, 78, Jaipur: early dementia, type 2 diabetes, hypertension. 4 medicines.
  - Ramesh Iyer, 71, Pune: recovering from hip replacement. 3 medicines, daily physio.
- 2 nurses (day nurse covers both, night nurse covers Kamla only), 2 family users (one per patient).
- 35 days of entries per patient, about 15 to 25 per day: vitals 2x daily (weight every 3 days), 4 meals, 5 to 8 water, every scheduled dose, 1 to 3 activities, mood 2x, 1 to 2 observations.
- Realistic noise plus injected events: a BP spike streak around day -10, two missed evening doses in the last week, one low-SpO2 reading, a low-mood stretch, improving physio minutes for Ramesh.
- Writes in batches of 400.
- Demo credentials (also in README): `nurse.anita@demo.carepal.test`, `nurse.ravi@demo.carepal.test`, `family.priya@demo.carepal.test`, `family.arjun@demo.carepal.test`, password `CarePal@123`.

## 9. Bonus features (only after all must-haves are deployed)

1. **Offline nurse form**: Firestore persistent cache (already in `firebase.js`) + vite-plugin-pwa for the app shell. Test: load once online, go offline in DevTools, add entries, reconnect, confirm they appear on the family side.
2. **Email alerts** (needs Blaze plan with a budget alert): Cloud Function `onDocumentCreated('patients/{pid}/entries/{eid}')`, uses `ranges.js` logic (copied into functions/), sends via Nodemailer with a Gmail app password stored in Functions secrets. Triggers: out-of-range vital, medication status `missed`/`refused`, observation severity `concern`. Debounce: one email per patient per metric per 6 hours (store `alerts/{pid}_{metric}`).
3. **Photos**: Firebase Storage needs Blaze. Otherwise use Cloudinary unsigned upload preset. Compress to ≤ 1280px before upload.

## 10. Conventions

- Named exports, one component per file, PascalCase components, camelCase functions.
- Every data function wraps Firestore errors and returns a user-facing message; UI shows toasts, never blank screens. Loading and empty states for every list.
- Never commit `.env`, service-account JSON or `functions/.secret*`. `.gitignore` covers them.
- The Firebase web config goes in `.env`; security comes from rules, not from hiding it. Exact variable names (already filled in by the developer, do not rename):
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
  `GOOGLE_APPLICATION_CREDENTIALS` (absolute path to the service-account JSON, outside the repo) is also in `.env`; only `scripts/seed.mjs` reads it, via dotenv. Vite never exposes non-`VITE_` variables to the browser.
- Collections are never created by hand in the console; the seed script creates them.
- `.firebaserc` uses the project ID from `VITE_FIREBASE_PROJECT_ID`. The Firebase CLI is already logged in on this machine.
- Times: store `Timestamp`, compute `dateKey` in IST, display IST. Never use `new Date().toISOString().slice(0,10)` for a date key (that is UTC and breaks entries between 00:00 and 05:30 IST).

## 10a. Quality tooling and hooks (required, the hooks depend on these names)

Install in phase 0: `eslint` (flat config from the Vite template), `prettier`, `eslint-config-prettier`, `vitest`, `jsdom`, `@testing-library/react`.

`package.json` scripts, exactly:

```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview",
"lint": "eslint .",
"format": "prettier --write .",
"test": "vitest run",
"check": "npm run lint && npm run test && npm run build",
"seed": "node scripts/seed.mjs",
"prepare": "git config core.hooksPath .githooks"
```

Optional, phase 2: `"test:rules"` runs Firestore rules tests with `@firebase/rules-unit-testing` against the emulator (`firebase emulators:exec --only firestore "vitest run tests/rules"`). The emulator needs Java 11+ (`sudo apt install -y openjdk-21-jre-headless`). Cover at least: family cannot read another patient, nurse cannot write for an unassigned patient, nobody can delete entries, nurse cannot edit after 12 h.

Hooks already in the repo (do not edit or bypass them):
- `.claude/hooks/guard.sh` blocks access to `.env`/service-account files and destructive commands (`--no-verify`, force push, `reset --hard`).
- `.claude/hooks/check-file.sh` runs Prettier and ESLint on each file you edit; fix reported errors immediately.
- `.claude/hooks/quality-gate.sh` runs `npm run check` when you finish a turn; a failure means you are not done. Fix the cause, never weaken or delete tests or disable lint rules.
- `.githooks/pre-commit` and `.githooks/pre-push` repeat these checks on every commit and push.

## 10b. Scaffolding into this existing repo

The repo already contains `.git`, `README.md`, `.gitignore`, `CLAUDE.md`, `.claude/` and `.githooks/`.
Never run `npm create vite` in the repo root and never choose "Remove existing files": that deletes everything except `.git`, including the hooks and this file.
Instead scaffold into a temporary folder (`npm create vite@latest /tmp/famcare-scaffold -- --template react`), copy its files into the repo without overwriting existing ones, merge its `.gitignore` entries into ours, then delete the temporary folder.

## 11. Build phases

| # | Phase | Done when |
|---|---|---|
| 0 | Scaffold Vite + Tailwind + router, `firebase.js`, `.env.example`, `firebase.json`, quality tooling and scripts from 10a | `npm run check` passes |
| 1 | `lib/time.js`, `lib/ranges.js`, `lib/schedule.js`, `lib/summaries.js` with a few unit tests (vitest) | tests pass |
| 2 | `firestore.rules`, indexes, `scripts/seed.mjs`; run seed | data visible in console |
| 3 | Auth provider, login, role redirect, RequireRole | both demo users land on the right home |
| 4 | Nurse: patient list, med checklist, quick-add forms, today list | entries appear in Firestore |
| 5 | Family: day picker + timeline (live today) | nurse entry shows on family screen within seconds |
| 6 | Vitals charts 7D/30D + weekly summary | numbers match a manual check of seed data |
| 7 | PDF report | 30-day PDF opens and is readable |
| 8 | Deploy hosting + rules + indexes; test on a real phone | public URL works |
| 9 | Bonus: offline → email alerts → photos | per section 9 |
| 10 | README: setup, architecture, decisions, assumptions, what next, AI tools used | done |

## 12. Assumptions (copy into README)

- Medicines come from each patient's prescription list (seeded), not a hospital inventory.
- Units: mmHg, bpm, %, mg/dL, °F, kg. Timezone IST.
- Reference ranges are adult defaults, configurable per patient.
- Patients do not log in. Operations/admin tooling (assigning nurses, editing prescriptions) is out of scope; done through the seed script.
- All data is synthetic.
