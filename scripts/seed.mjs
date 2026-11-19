// Seeds the demo project: Auth users with role claims, user docs, 2 patients, their
// medications and 35 days of care entries ending today (IST).
//
//   npm run seed               write to the project in VITE_FIREBASE_PROJECT_ID
//   npm run seed -- --dry-run  generate and print a summary, write nothing
//
// Deterministic: a fixed PRNG seed per patient, fixed document IDs and fixed Auth UIDs, so a
// rerun on the same day produces identical data. Idempotent: demo docs are deleted and
// recreated. Only the demo IDs below are touched.
import 'dotenv/config';
import { addDaysToKey, atIST, toDateKey, todayKey } from '../src/lib/time.js';
import { expectedDoses } from '../src/lib/schedule.js';
import { getRanges, outOfRangeFields } from '../src/lib/ranges.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DAYS = 35;
const PASSWORD = 'CarePal@123';
const BATCH_SIZE = 400;

// ---------------------------------------------------------------- deterministic random

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRandom(seed) {
  const next = mulberry32(seed);
  const r = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [value, w] of pairs) {
        if ((x -= w) < 0) return value;
      }
      return pairs[pairs.length - 1][0];
    },
    normal: (mean, sd) => {
      const u = 1 - next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return r;
}

const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const round1 = (x) => Math.round(x * 10) / 10;
const hhmm = (minutes) => {
  const m = clamp(Math.round(minutes), 0, 24 * 60 - 1);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- people

const NOW = new Date();
const TODAY = todayKey(NOW);
const dayKey = (offset) => addDaysToKey(TODAY, offset);

const NURSES = {
  anita: {
    uid: 'demo-nurse-anita',
    email: 'nurse.anita@demo.carepal.test',
    fullName: 'Anita Sharma',
    phone: '+91 90000 00001',
    shift: 'Day (08:00 to 20:00)',
  },
  ravi: {
    uid: 'demo-nurse-ravi',
    email: 'nurse.ravi@demo.carepal.test',
    fullName: 'Ravi Kumar',
    phone: '+91 90000 00002',
    shift: 'Night (20:00 to 08:00)',
  },
};

const FAMILY = {
  priya: {
    uid: 'demo-family-priya',
    email: 'family.priya@demo.carepal.test',
    fullName: 'Priya Sharma',
    phone: '+91 90000 00003',
    relation: 'Daughter',
  },
  arjun: {
    uid: 'demo-family-arjun',
    email: 'family.arjun@demo.carepal.test',
    fullName: 'Arjun Iyer',
    phone: '+91 90000 00004',
    relation: 'Son',
  },
};

const careTeam = (...nurses) =>
  nurses.map((n) => ({ id: n.uid, fullName: n.fullName, shift: n.shift }));

const PATIENTS = {
  kamla: {
    id: 'demo-kamla-devi',
    seed: 20261,
    doc: {
      fullName: 'Kamla Devi',
      dob: '1948-03-14',
      gender: 'female',
      city: 'Jaipur',
      conditions: ['Early dementia', 'Type 2 diabetes', 'Hypertension'],
      primaryDoctor: 'Dr. Meera Agarwal (Physician, Jaipur)',
      nurseIds: [NURSES.anita.uid, NURSES.ravi.uid],
      familyIds: [FAMILY.priya.uid],
      nurses: careTeam(NURSES.anita, NURSES.ravi),
      // Relaxed fasting target agreed with her physician (demonstrates per-patient overrides).
      rangeOverrides: { sugarFasting: { min: 80, max: 140 } },
    },
    medications: [
      {
        id: 'glimepiride',
        name: 'Glimepiride',
        strength: '1 mg',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'Before breakfast',
        times: ['07:30'],
      },
      {
        id: 'amlodipine',
        name: 'Amlodipine',
        strength: '5 mg',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'Morning, with water',
        times: ['08:00'],
      },
      {
        id: 'metformin',
        name: 'Metformin',
        strength: '500 mg',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'After breakfast and after dinner',
        times: ['09:00', '20:30'],
      },
      {
        id: 'donepezil',
        name: 'Donepezil',
        strength: '5 mg',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'At bedtime',
        times: ['21:00'],
      },
    ].map((m) => ({ ...m, startDate: dayKey(-120), endDate: null, active: true })),
  },
  ramesh: {
    id: 'demo-ramesh-iyer',
    seed: 20262,
    doc: {
      fullName: 'Ramesh Iyer',
      dob: '1955-07-02',
      gender: 'male',
      city: 'Pune',
      conditions: ['Recovering from right hip replacement'],
      primaryDoctor: 'Dr. Sanjay Kulkarni (Orthopaedics, Pune)',
      nurseIds: [NURSES.anita.uid],
      familyIds: [FAMILY.arjun.uid],
      nurses: careTeam(NURSES.anita),
    },
    medications: [
      {
        id: 'paracetamol',
        name: 'Paracetamol',
        strength: '650 mg',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'After food, for pain',
        times: ['08:00', '14:00', '20:00'],
        startDate: dayKey(-40),
        endDate: null,
      },
      {
        id: 'apixaban',
        name: 'Apixaban',
        strength: '2.5 mg',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'Clot prevention after surgery, 35-day course',
        times: ['09:00', '21:00'],
        startDate: dayKey(-40),
        endDate: dayKey(-6),
      },
      {
        id: 'calcium-d3',
        name: 'Calcium + Vitamin D3',
        strength: '500 mg / 250 IU',
        dose: '1 tablet',
        route: 'oral',
        instructions: 'After lunch',
        times: ['13:30'],
        startDate: dayKey(-40),
        endDate: null,
      },
    ].map((m) => ({ ...m, active: true })),
  },
};

const USERS = [
  { ...NURSES.anita, role: 'nurse', patientIds: [PATIENTS.kamla.id, PATIENTS.ramesh.id] },
  { ...NURSES.ravi, role: 'nurse', patientIds: [PATIENTS.kamla.id] },
  { ...FAMILY.priya, role: 'family', patientIds: [PATIENTS.kamla.id] },
  { ...FAMILY.arjun, role: 'family', patientIds: [PATIENTS.ramesh.id] },
];

// ---------------------------------------------------------------- injected events

// Day offsets relative to today (0 = today, -1 = yesterday).
const EVENTS = {
  kamlaBpSpike: [-11, -10, -9],
  kamlaLowMood: [-16, -15, -14, -13, -12],
  kamlaMissedEvening: {
    [-5]: 'Asleep early, could not be woken for the dose',
    [-2]: 'Strip finished; refill arrived next morning',
  },
  rameshLowSpo2: -7,
};

const MOOD_TAGS = {
  5: ['cheerful', 'calm'],
  4: ['calm', 'cheerful'],
  3: ['calm', 'sleepy', 'confused'],
  2: ['withdrawn', 'anxious', 'confused'],
  1: ['withdrawn', 'tearful'],
};

const MEALS = {
  kamla: {
    breakfast: [
      'Vegetable poha, tea without sugar',
      'Besan chilla, curd',
      'Oats upma, tea without sugar',
      'Moong dal cheela, mint chutney',
    ],
    lunch: [
      '2 rotis, dal, lauki sabzi, salad',
      '2 rotis, rajma, cucumber raita',
      'Bajra roti, kadhi, gatte ki sabzi',
      'Brown rice, dal, palak sabzi',
    ],
    snack: ['Roasted chana, buttermilk', 'Apple slices', 'Sprouts chaat', 'Guava, green tea'],
    dinner: [
      'Vegetable khichdi, curd',
      '2 rotis, moong dal, bhindi',
      'Dalia, vegetable soup',
      '1 roti, paneer bhurji, salad',
    ],
  },
  ramesh: {
    breakfast: [
      'Idli, sambar',
      'Upma, filter coffee',
      'Dosa, coconut chutney',
      'Ragi porridge, banana',
    ],
    lunch: [
      'Rice, sambar, beans poriyal, curd',
      'Chapati, dal, cabbage sabzi',
      'Rice, rasam, egg curry',
      'Bisi bele bath, curd',
    ],
    snack: ['Banana, milk', 'Sundal', 'Marie biscuits, coffee', 'Fruit bowl'],
    dinner: [
      'Chapati, dal, vegetable kurma',
      'Curd rice, pickle',
      'Rasam rice, papad',
      'Vegetable pulao, raita',
    ],
  },
};

const OBSERVATIONS = {
  kamla: [
    'Recognised Priya on video call and chatted for 10 minutes.',
    'Asked about her late husband twice; redirected gently with old photos.',
    'Feet checked: no cuts or swelling.',
    'Slept 40 minutes after lunch.',
    'Enjoyed bhajans in the evening, sang along.',
    'Needed reminders to drink water.',
    'Skin intact, no pressure areas.',
    'Bowel movement normal.',
  ],
  kamlaNight: [
    'Slept by 22:30, woke once to use the washroom, settled quickly.',
    'Restless till midnight, settled after warm milk.',
    'Slept through the night.',
  ],
  ramesh: [
    'Wound site clean and dry, no redness.',
    'Pain 3/10 before physio, 2/10 after rest.',
    'Climbed 4 steps with railing under supervision.',
    'Hip precautions followed; using raised toilet seat.',
    'Mild swelling at right ankle, legs elevated for 30 minutes.',
    'Bowel movement normal.',
    'Watched cricket with neighbour, in good spirits.',
    'Compression stockings on in the morning, removed at night.',
  ],
};

// ---------------------------------------------------------------- day generation

function nurseFor(patientKey, minutes) {
  if (patientKey === 'ramesh') return NURSES.anita;
  return minutes >= 20 * 60 || minutes < 8 * 60 ? NURSES.ravi : NURSES.anita;
}

function generateDay(patientKey, offset, rnd) {
  const patient = PATIENTS[patientKey];
  const dateKey = dayKey(offset);
  const isKamla = patientKey === 'kamla';
  const lowMood = isKamla && EVENTS.kamlaLowMood.includes(offset);
  const bpSpike = isKamla && EVENTS.kamlaBpSpike.includes(offset);
  const progress = (offset + DAYS - 1) / (DAYS - 1); // 0 on the first day, 1 today
  const entries = [];

  const add = (minutes, type, payload) => {
    const nurse = nurseFor(patientKey, minutes);
    entries.push({ type, minutes, nurse, ...payload });
  };

  // Vitals, twice a day. Noise is clamped inside the reference band so that the only
  // out-of-range readings are the injected events (easy to verify by hand).
  const vitalsTimes = isKamla ? [8 * 60 + 15, 21 * 60 + 30] : [8 * 60 + 30, 18 * 60];
  vitalsTimes.forEach((base, i) => {
    const morning = i === 0;
    const v = {
      systolic: Math.round(clamp(rnd.normal(isKamla ? 128 : 122, 5), 112, 138)),
      diastolic: Math.round(clamp(rnd.normal(isKamla ? 80 : 78, 4), 68, 88)),
      pulse: Math.round(clamp(rnd.normal(isKamla ? 76 : 80 - 6 * progress, 5), 64, 96)),
      spo2: Math.round(clamp(rnd.normal(97, 0.8), 95, 99)),
      tempF: round1(clamp(rnd.normal(98.2, 0.3), 97.4, 99.2)),
    };
    if (isKamla) {
      v.sugarContext = morning ? 'fasting' : 'post_meal';
      v.sugar = Math.round(
        morning ? clamp(rnd.normal(116, 8), 96, 138) : clamp(rnd.normal(152, 10), 128, 176),
      );
    }
    if (bpSpike) {
      v.systolic = Math.round(clamp(rnd.normal(158, 5), 148, 168));
      v.diastolic = Math.round(clamp(rnd.normal(96, 2), 92, 100));
    }
    if (!isKamla && offset === EVENTS.rameshLowSpo2 && !morning) {
      v.spo2 = 91;
      v.pulse = 96;
    }
    if (morning && (offset - 1) % 3 === 0) {
      const w = isKamla ? 58.4 + rnd.normal(0, 0.2) : 74.6 - 1.4 * progress + rnd.normal(0, 0.2);
      v.weightKg = round1(w);
    }
    add(base + rnd.int(-10, 10), 'vitals', v);
  });

  // Meals: breakfast, lunch, snack, dinner.
  const mealTimes = {
    breakfast: 8 * 60 + 30,
    lunch: 13 * 60,
    snack: 16 * 60 + 30,
    dinner: 19 * 60 + 45,
  };
  for (const [slot, base] of Object.entries(mealTimes)) {
    const portion = lowMood
      ? rnd.weighted([
          [0.25, 3],
          [0.5, 4],
          [0.75, 2],
          [1, 1],
        ])
      : rnd.weighted([
          [1, 45],
          [0.75, 30],
          [0.5, 17],
          [0.25, 8],
        ]);
    add(base + rnd.int(-15, 15), 'meal', {
      slot,
      items: rnd.pick(MEALS[patientKey][slot]),
      portion,
    });
  }

  // Water: 5 to 8 drinks spread from 07:00 to 21:00.
  const drinks = rnd.int(5, isKamla ? 7 : 8);
  for (let i = 0; i < drinks; i++) {
    const base = 7 * 60 + ((14 * 60) / drinks) * (i + 0.5);
    add(base + rnd.int(-20, 20), 'water', { ml: rnd.pick([150, 200, 250, 250, 300]) });
  }

  // Every scheduled dose, using the same expansion as the app.
  for (const dose of expectedDoses(patient.medications, dateKey)) {
    const [h, m] = dose.scheduledTime.split(':').map(Number);
    const scheduled = h * 60 + m;
    let status = 'given';
    let reason;
    const missedReason = EVENTS.kamlaMissedEvening[offset];
    if (
      isKamla &&
      dose.medicationId === 'metformin' &&
      dose.scheduledTime === '20:30' &&
      missedReason
    ) {
      status = 'missed';
      reason = missedReason;
    } else if (isKamla && offset < -7 && rnd.chance(0.015)) {
      status = 'refused';
      reason = rnd.pick(['Spat out the tablet', 'Agitated, refused; tried again after 30 minutes']);
    }
    add(scheduled + (status === 'given' ? rnd.int(0, 25) : 45), 'medication', {
      medicationId: dose.medicationId,
      medicationName: dose.medicationName,
      scheduledTime: dose.scheduledTime,
      status,
      ...(reason ? { reason } : {}),
    });
  }

  // Activities: 1 to 3 a day.
  if (isKamla) {
    if (rnd.chance(lowMood ? 0.3 : 0.85)) {
      add(7 * 60 + 15 + rnd.int(0, 20), 'activity', {
        kind: 'walk',
        durationMin: rnd.int(15, 25),
        notes: 'Morning walk in the colony park with support',
      });
    }
    add(11 * 60 + rnd.int(0, 30), 'activity', {
      kind: 'exercise',
      durationMin: rnd.int(10, 15),
      notes: 'Chair exercises',
    });
    if (rnd.chance(0.5)) {
      add(17 * 60 + rnd.int(0, 40), 'activity', {
        kind: 'other',
        durationMin: rnd.int(20, 30),
        notes: rnd.pick(['Memory cards', 'Bhajans', 'Sorting old photos']),
      });
    }
  } else {
    const physio = Math.round(10 + 25 * progress + rnd.int(-2, 2));
    add(10 * 60 + rnd.int(0, 30), 'activity', {
      kind: 'physio',
      durationMin: physio,
      notes: 'Hip strengthening and gait training',
    });
    if (rnd.chance(0.4 + 0.5 * progress)) {
      add(17 * 60 + rnd.int(0, 30), 'activity', {
        kind: 'walk',
        durationMin: Math.round(5 + 15 * progress + rnd.int(-2, 2)),
        notes: progress < 0.5 ? 'Walker, indoors' : 'Walking stick, building corridor',
      });
    }
    if (offset > -7 && rnd.chance(0.3)) {
      add(11 * 60 + 30, 'activity', {
        kind: 'outing',
        durationMin: rnd.int(20, 40),
        notes: 'Short car ride to the temple',
      });
    }
  }

  // Mood, twice a day.
  for (const base of [10 * 60 + 30, 17 * 60 + 30]) {
    let score;
    if (lowMood) score = rnd.int(1, 2);
    else if (isKamla)
      score = rnd.weighted([
        [5, 15],
        [4, 45],
        [3, 35],
        [2, 5],
      ]);
    else score = clamp(Math.round(3 + 1.5 * progress + rnd.normal(0, 0.5)), 2, 5);
    let tags = [rnd.pick(MOOD_TAGS[score])];
    if (isKamla && base > 17 * 60 && !lowMood && rnd.chance(0.12)) {
      score = Math.min(score, 3);
      tags = ['agitated', 'confused'];
    }
    if (!isKamla && progress < 0.3 && rnd.chance(0.4)) tags.push('anxious');
    add(base + rnd.int(-15, 15), 'mood', { score, tags: [...new Set(tags)] });
  }

  // Observations: 1 to 2 a day, plus a concern on every injected event.
  add(15 * 60 + rnd.int(0, 60), 'observation', {
    text: rnd.pick(OBSERVATIONS[patientKey]),
    severity: 'info',
  });
  if (isKamla && rnd.chance(0.5)) {
    add(23 * 60 + rnd.int(0, 30), 'observation', {
      text: rnd.pick(OBSERVATIONS.kamlaNight),
      severity: 'info',
    });
  }
  if (bpSpike && offset === -10) {
    add(9 * 60, 'observation', {
      text: 'BP high for the second day (around 158/96). Informed Dr. Agarwal; continue medicines and recheck twice daily.',
      severity: 'concern',
    });
  }
  if (lowMood && offset === -14) {
    add(18 * 60, 'observation', {
      text: 'Withdrawn and tearful most of the day, ate very little. Family informed.',
      severity: 'concern',
    });
  }
  if (isKamla && EVENTS.kamlaMissedEvening[offset]) {
    add(21 * 60 + 15, 'observation', {
      text: `Evening metformin missed: ${EVENTS.kamlaMissedEvening[offset].toLowerCase()}.`,
      severity: 'concern',
    });
  }
  if (!isKamla && offset === EVENTS.rameshLowSpo2) {
    add(18 * 60 + 20, 'observation', {
      text: 'SpO2 91% at rest after physio day. Deep breathing done, recovered to 95% in 15 minutes. Will monitor.',
      severity: 'concern',
    });
  }

  // Build documents; today only includes what has already happened.
  return entries
    .map((e) => {
      const time = hhmm(e.minutes);
      const at = atIST(dateKey, time);
      const { minutes: _m, nurse, ...payload } = e;
      return { at, nurse, payload: { ...payload, dateKey: toDateKey(at) } };
    })
    .filter((e) => e.at <= NOW)
    .sort((a, b) => a.at - b.at);
}

function generatePatient(patientKey) {
  const rnd = makeRandom(PATIENTS[patientKey].seed);
  const days = [];
  for (let offset = -(DAYS - 1); offset <= 0; offset++) {
    // Each day draws from the same stream in order, so the data depends only on the seed
    // and today's date.
    days.push({ offset, dateKey: dayKey(offset), entries: generateDay(patientKey, offset, rnd) });
  }
  return days;
}

// ---------------------------------------------------------------- output

function summarize(patientKey, days) {
  const counts = days.map((d) => d.entries.length);
  const past = counts.slice(0, -1);
  const byType = {};
  for (const d of days)
    for (const e of d.entries) byType[e.payload.type] = (byType[e.payload.type] ?? 0) + 1;
  console.log(
    `${PATIENTS[patientKey].doc.fullName}: ${counts.reduce((a, b) => a + b, 0)} entries over ${days.length} days ` +
      `(${Math.min(...past)} to ${Math.max(...past)} per full day, ${counts.at(-1)} so far today)`,
  );
  console.log('  by type:', JSON.stringify(byType));
  const ranges = getRanges(PATIENTS[patientKey].doc);
  for (const d of days) {
    for (const e of d.entries) {
      const time = e.payload.type === 'medication' ? e.payload.scheduledTime : '';
      if (e.payload.type === 'vitals') {
        const flags = outOfRangeFields(e.payload, ranges);
        const text = Object.entries(flags).map(([k, v]) => `${k}=${e.payload[k]} ${v}`);
        if (text.length) console.log(`  out of range ${d.dateKey}: ${text.join(', ')}`);
      } else if (e.payload.type === 'medication' && e.payload.status !== 'given') {
        console.log(`  dose ${e.payload.status} ${d.dateKey} ${time} ${e.payload.medicationName}`);
      }
    }
  }
}

async function main() {
  const generated = Object.fromEntries(Object.keys(PATIENTS).map((k) => [k, generatePatient(k)]));
  console.log(`Seed window: ${dayKey(-(DAYS - 1))} to ${TODAY} (IST)`);
  for (const [k, days] of Object.entries(generated)) summarize(k, days);

  if (DRY_RUN) {
    console.log('Dry run: nothing written.');
    return;
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('VITE_FIREBASE_PROJECT_ID is not set');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set');

  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, Timestamp, FieldPath } = await import('firebase-admin/firestore');

  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  const db = getFirestore();
  console.log(`Writing to project ${projectId}`);

  // 1. Auth users with fixed UIDs and role claims.
  for (const u of USERS) {
    try {
      const existing = await auth.getUserByEmail(u.email);
      if (existing.uid !== u.uid) await auth.deleteUser(existing.uid);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
    try {
      await auth.updateUser(u.uid, {
        email: u.email,
        password: PASSWORD,
        displayName: u.fullName,
        emailVerified: true,
      });
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: PASSWORD,
        displayName: u.fullName,
        emailVerified: true,
      });
    }
    await auth.setCustomUserClaims(u.uid, { role: u.role });
  }
  console.log(`Auth: ${USERS.length} users with role claims`);

  // 2. Delete previous demo docs (patients recursively, user docs, alert debounce docs).
  for (const p of Object.values(PATIENTS)) {
    await db.recursiveDelete(db.doc(`patients/${p.id}`));
    const alerts = await db
      .collection('alerts')
      .where(FieldPath.documentId(), '>=', `${p.id}_`)
      .where(FieldPath.documentId(), '<', `${p.id}_`)
      .get();
    await Promise.all(alerts.docs.map((d) => d.ref.delete()));
  }
  await Promise.all(USERS.map((u) => db.doc(`users/${u.uid}`).delete()));

  // 3. Recreate everything in batches of BATCH_SIZE.
  const ops = [];
  for (const u of USERS) {
    const { uid, fullName, phone, email, role, patientIds } = u;
    ops.push([db.doc(`users/${uid}`), { fullName, phone, email, role, patientIds }]);
  }
  for (const [key, p] of Object.entries(PATIENTS)) {
    ops.push([db.doc(`patients/${p.id}`), p.doc]);
    for (const { id, ...med } of p.medications) {
      ops.push([db.doc(`patients/${p.id}/medications/${id}`), med]);
    }
    for (const day of generated[key]) {
      day.entries.forEach((e, i) => {
        // Logged a few minutes after the event; past entries are therefore outside the
        // 12 h edit window, today's are still editable by their nurse.
        const created = Timestamp.fromMillis(e.at.getTime() + (2 + (i % 4)) * 60 * 1000);
        ops.push([
          db.doc(`patients/${p.id}/entries/${day.dateKey}-${String(i).padStart(2, '0')}`),
          {
            ...e.payload,
            at: Timestamp.fromDate(e.at),
            nurseId: e.nurse.uid,
            nurseName: e.nurse.fullName,
            createdAt: created,
            updatedAt: created,
          },
        ]);
      });
    }
  }
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const [ref, data] of ops.slice(i, i + BATCH_SIZE)) batch.set(ref, data);
    await batch.commit();
  }
  console.log(
    `Firestore: ${ops.length} documents written in ${Math.ceil(ops.length / BATCH_SIZE)} batches`,
  );
  console.log(`Demo password for all users: ${PASSWORD}`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
