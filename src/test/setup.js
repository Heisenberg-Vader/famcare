import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unit tests never talk to Firebase. Tests that need specific behaviour mock the data
// modules (or this module) themselves.
vi.mock('../lib/firebase.js', () => ({
  app: {},
  auth: {},
  isFirebaseConfigured: true,
  cacheModeFor: (role) => (role === 'nurse' ? 'persistent' : 'memory'),
  initDb: vi.fn(),
  getDb: () => {
    throw new Error('Firestore is not available in unit tests; mock the data module');
  },
  getDbForWipe: vi.fn(() => ({})),
  forgetDb: vi.fn(),
  getDbCacheMode: () => null,
}));

afterEach(() => cleanup());
