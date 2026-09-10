// Vitest global setup: extends expect with jest-dom matchers and clears the
// DOM between tests. Loaded via vite.config.js `test.setupFiles`.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Stub the Firebase client so importing db.js in unit tests (e.g. the pure
// derivation functions used by overlap.test.js) does NOT initialize a real
// Firebase app. Without config, getDatabase() throws at import time and crashes
// the suite. Tests that exercise db.js use only its pure, snapshot-based
// functions, which never touch these stubs.
vi.mock('../lib/firebase.js', () => ({
  app: {},
  db: {},
  auth: {},
  isFirebaseConfigured: () => false,
}))
vi.mock('./firebase.js', () => ({
  app: {},
  db: {},
  auth: {},
  isFirebaseConfigured: () => false,
}))

afterEach(() => {
  cleanup()
})
