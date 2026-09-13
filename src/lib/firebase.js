// Firebase client — single initialization point for the whole app.
// Config comes from VITE_-prefixed env vars (.env, gitignored). The web config
// is public-by-design (it identifies the project, it is not a secret); all
// access control lives in the Realtime Database Security Rules + the data model
// (PROJECT_PLAN §9), never in the secrecy of these values.
//
// Modular v9+ SDK: we import only `firebase/app`, `firebase/database`, and
// `firebase/auth` so the bundle stays small (tree-shaken). Analytics is
// deliberately NOT initialized — the plan does not use it and it would set a
// tracking cookie we do not want under the Data Privacy Act obligations (§10).

import { initializeApp } from 'firebase/app'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True only when the essential Firebase settings are present. */
export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId)
}

if (!isFirebaseConfigured()) {
  // Loud, early failure — a silent misconfig here shows up later as confusing
  // permission-denied / null-data errors. Better to say exactly what is missing.
  // eslint-disable-next-line no-console
  console.error(
    '[firebase] Missing config. Set VITE_FIREBASE_* in .env (see .env.example). ' +
      'The app cannot reach the backend until these are filled in.',
  )
}

// Initialize defensively. When config is missing (no .env yet) we still create
// an app object with a harmless placeholder so top-level imports never THROW —
// a throw here blanks the whole page. The app runs in "unconfigured" mode
// (see isFirebaseConfigured) and the UI falls back to local behavior instead of
// crashing. Real config swaps this out transparently once .env is filled in.
const configured = isFirebaseConfigured()

const safeConfig = configured
  ? firebaseConfig
  : {
      apiKey: 'demo-unconfigured',
      authDomain: 'demo.firebaseapp.com',
      databaseURL: 'https://demo-default-rtdb.firebaseio.com',
      projectId: 'demo-unconfigured',
      appId: 'demo-unconfigured',
    }

let _app = null
let _db = null
let _auth = null
try {
  _app = initializeApp(safeConfig)
  _db = getDatabase(_app)
  _auth = getAuth(_app)
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[firebase] Initialization failed; running without a backend.', err)
}

export const app = _app
export const db = _db
export const auth = _auth

// ── Local emulator wiring (opt-in) ──────────────────────────────────────────
// Set VITE_USE_FIREBASE_EMULATOR=true in .env to point the client at the local
// Firebase Emulator Suite instead of the cloud project. Useful for testing the
// security rules behaviorally without touching production data.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectDatabaseEmulator(db, '127.0.0.1', 9000)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    // eslint-disable-next-line no-console
    console.info('[firebase] Using local emulator suite (RTDB :9000, Auth :9099).')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] Emulator connect failed; falling back to cloud.', err)
  }
}
