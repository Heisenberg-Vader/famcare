import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

let env;

const NURSE_DAY = 'nurse-anita';
const NURSE_NIGHT = 'nurse-ravi';
const FAMILY_K = 'family-priya';
const FAMILY_R = 'family-arjun';

const as = (uid, role) => env.authenticatedContext(uid, { role }).firestore();
const dayNurse = () => as(NURSE_DAY, 'nurse');
const nightNurse = () => as(NURSE_NIGHT, 'nurse');
const priya = () => as(FAMILY_K, 'family');

function newEntry(nurseId, overrides = {}) {
  return {
    type: 'water',
    ml: 250,
    at: Timestamp.now(),
    dateKey: '2026-11-19',
    nurseId,
    nurseName: 'Test Nurse',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedEntry(id, pid, createdAgoMs, nurseId = NURSE_DAY) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const created = Timestamp.fromMillis(Date.now() - createdAgoMs);
    await setDoc(doc(ctx.firestore(), `patients/${pid}/entries/${id}`), {
      type: 'water',
      ml: 200,
      at: created,
      dateKey: '2026-11-19',
      nurseId,
      nurseName: 'Seeded',
      createdAt: created,
      updatedAt: created,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-carepal',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'patients/kamla'), {
      fullName: 'Kamla Devi',
      nurseIds: [NURSE_DAY, NURSE_NIGHT],
      familyIds: [FAMILY_K],
    });
    await setDoc(doc(db, 'patients/ramesh'), {
      fullName: 'Ramesh Iyer',
      nurseIds: [NURSE_DAY],
      familyIds: [FAMILY_R],
    });
    await setDoc(doc(db, 'patients/kamla/medications/met'), { name: 'Metformin' });
    await setDoc(doc(db, 'patients/ramesh/medications/par'), { name: 'Paracetamol' });
    await setDoc(doc(db, `users/${FAMILY_K}`), { fullName: 'Priya', role: 'family' });
    await setDoc(doc(db, `users/${NURSE_DAY}`), { fullName: 'Anita', role: 'nurse' });
  });
});

describe('users', () => {
  it('lets a user read only their own doc and never write', async () => {
    await assertSucceeds(getDoc(doc(priya(), `users/${FAMILY_K}`)));
    await assertFails(getDoc(doc(priya(), `users/${NURSE_DAY}`)));
    await assertFails(setDoc(doc(priya(), `users/${FAMILY_K}`), { role: 'nurse' }));
  });

  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `users/${FAMILY_K}`)));
  });
});

describe('patients and medications', () => {
  it('family cannot read another patient', async () => {
    await assertSucceeds(getDoc(doc(priya(), 'patients/kamla')));
    await assertFails(getDoc(doc(priya(), 'patients/ramesh')));
    await assertFails(getDoc(doc(priya(), 'patients/ramesh/medications/par')));
    await assertFails(getDocs(collection(priya(), 'patients/ramesh/entries')));
  });

  it('allows filtered list queries and rejects unfiltered ones', async () => {
    const db = dayNurse();
    await assertSucceeds(
      getDocs(query(collection(db, 'patients'), where('nurseIds', 'array-contains', NURSE_DAY))),
    );
    await assertFails(getDocs(collection(db, 'patients')));
    await assertSucceeds(
      getDocs(
        query(collection(priya(), 'patients'), where('familyIds', 'array-contains', FAMILY_K)),
      ),
    );
  });

  it('a role claim is required, membership alone is not enough', async () => {
    const noRole = env.authenticatedContext(FAMILY_K).firestore();
    await assertFails(getDoc(doc(noRole, 'patients/kamla')));
    const wrongRole = as(FAMILY_K, 'nurse');
    await assertFails(getDoc(doc(wrongRole, 'patients/kamla')));
  });

  it('nobody can write patients or medications from the client', async () => {
    await assertFails(updateDoc(doc(dayNurse(), 'patients/kamla'), { fullName: 'X' }));
    await assertFails(setDoc(doc(dayNurse(), 'patients/kamla/medications/new'), { name: 'X' }));
  });
});

describe('entries: create', () => {
  it('assigned nurse can create an entry with their own nurseId', async () => {
    await assertSucceeds(setDoc(doc(dayNurse(), 'patients/kamla/entries/e1'), newEntry(NURSE_DAY)));
  });

  it('nurse cannot write for an unassigned patient', async () => {
    await assertFails(
      setDoc(doc(nightNurse(), 'patients/ramesh/entries/e1'), newEntry(NURSE_NIGHT)),
    );
  });

  it('rejects spoofed nurseId, unknown type, bad dateKey and client timestamps', async () => {
    const ref = doc(dayNurse(), 'patients/kamla/entries/e1');
    await assertFails(setDoc(ref, newEntry(NURSE_NIGHT)));
    await assertFails(setDoc(ref, newEntry(NURSE_DAY, { type: 'diagnosis' })));
    await assertFails(setDoc(ref, newEntry(NURSE_DAY, { dateKey: 20261119 })));
    await assertFails(setDoc(ref, newEntry(NURSE_DAY, { createdAt: Timestamp.now() })));
    await assertFails(
      setDoc(ref, newEntry(NURSE_DAY, { at: Timestamp.fromMillis(Date.now() + 3600_000) })),
    );
  });

  it('family cannot create entries', async () => {
    await assertFails(setDoc(doc(priya(), 'patients/kamla/entries/e1'), newEntry(FAMILY_K)));
  });
});

describe('entries: update and delete', () => {
  it('creator can edit within 12 hours', async () => {
    await seedEntry('recent', 'kamla', 60 * 60 * 1000);
    await assertSucceeds(
      updateDoc(doc(dayNurse(), 'patients/kamla/entries/recent'), {
        ml: 300,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('nurse cannot edit after 12 hours', async () => {
    await seedEntry('old', 'kamla', 13 * 60 * 60 * 1000);
    await assertFails(
      updateDoc(doc(dayNurse(), 'patients/kamla/entries/old'), {
        ml: 300,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("another nurse cannot edit someone else's entry", async () => {
    await seedEntry('recent', 'kamla', 60 * 60 * 1000);
    await assertFails(
      updateDoc(doc(nightNurse(), 'patients/kamla/entries/recent'), {
        ml: 300,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('cannot change nurseId, type or createdAt', async () => {
    await seedEntry('recent', 'kamla', 60 * 60 * 1000);
    const ref = doc(dayNurse(), 'patients/kamla/entries/recent');
    await assertFails(updateDoc(ref, { type: 'meal', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { nurseId: NURSE_NIGHT, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
  });

  it('nobody can delete entries', async () => {
    await seedEntry('recent', 'kamla', 60 * 1000);
    await assertFails(deleteDoc(doc(dayNurse(), 'patients/kamla/entries/recent')));
    await assertFails(deleteDoc(doc(nightNurse(), 'patients/kamla/entries/recent')));
    await assertFails(deleteDoc(doc(priya(), 'patients/kamla/entries/recent')));
  });

  it('family can read entries of their patient', async () => {
    await seedEntry('recent', 'kamla', 60 * 1000);
    await assertSucceeds(getDocs(collection(priya(), 'patients/kamla/entries')));
  });
});
