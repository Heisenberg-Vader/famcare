// Firebase setup. Firestore is NOT created at import time: it is created by initDb(role) once
// the auth claim is known, so each role gets the right local cache:
//   nurse  -> persistentLocalCache (IndexedDB) so logging keeps working offline
//   family -> memoryLocalCache, nothing is written to the device
// secureSignOut() terminates the instance and wipes IndexedDB.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isFirebaseConfigured) {
  console.error('Firebase config missing: set the VITE_FIREBASE_* variables (see .env.example).');
}

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

let db = null;
let dbCacheMode = null;

export const cacheModeFor = (role) => (role === 'nurse' ? 'persistent' : 'memory');

/** Creates the Firestore instance for `role`. Calling again with the same role is a no-op. */
export function initDb(role) {
  const mode = cacheModeFor(role);
  if (db) {
    if (dbCacheMode !== mode) {
      throw new Error(`Firestore already initialised with ${dbCacheMode} cache`);
    }
    return db;
  }
  const localCache =
    mode === 'persistent'
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache();
  db = initializeFirestore(app, { localCache });
  dbCacheMode = mode;
  return db;
}

/** The Firestore instance; throws if used before the role is known. */
export function getDb() {
  if (!db) throw new Error('Firestore used before sign-in resolved the role');
  return db;
}

/** Instance to wipe on sign-out. Creates a throwaway memory instance when none exists. */
export function getDbForWipe() {
  return db ?? initializeFirestore(app, { localCache: memoryLocalCache() });
}

/** Forget the instance after terminate() so a later sign-in creates a fresh one. */
export function forgetDb() {
  db = null;
  dbCacheMode = null;
}

export function getDbCacheMode() {
  return dbCacheMode;
}
