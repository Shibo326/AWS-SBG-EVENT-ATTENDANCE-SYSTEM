// Bootstrap the FIRST admin into /staff (PROJECT_PLAN §9.2).
//
// Chicken-and-egg: the security rules only let an admin write /staff, but on a
// fresh database there is no admin yet. This one-time script writes that first
// record directly via the Firebase RTDB REST API, reading the database URL from
// your .env. After it runs, sign in and manage all other staff from the app.
//
// USAGE:
//   node scripts/seed-admin.mjs <UID> "<Display Name>" <email> [role]
//   role defaults to "admin"; use "gate_staff" for a scanner-only account.
//
// The UID is the Firebase Auth User UID (Authentication → Users → copy UID).
//
// IMPORTANT: the deployed rules deny an unauthenticated write to /staff. Run
// this in ONE of these windows:
//   (a) before you deploy the rules (database still in locked/open default), or
//   (b) temporarily set /staff ".write": true in the Console, run this, revert.
// If neither is convenient, just paste the JSON this script prints into the
// Console at /staff/<uid> by hand — same result, no REST call.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env'), 'utf8')
    const out = {}
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

// AWS SBG defaults — so seeding the club's admin is a one-liner:
//   node scripts/seed-admin.mjs <UID>
// Override name/email/role by passing them explicitly.
const DEFAULT_NAME = 'AWS SBG Admin'
const DEFAULT_EMAIL = 'admin@awssbg.dev'

const [uid, displayName = DEFAULT_NAME, email = DEFAULT_EMAIL, role = 'admin'] = process.argv.slice(2)

if (!uid) {
  console.error('Usage: node scripts/seed-admin.mjs <UID> ["<Display Name>"] [email] [role]')
  console.error('  <UID> is the Firebase Auth User UID (Authentication → Users → copy UID).')
  console.error(`  Defaults: name="${DEFAULT_NAME}", email="${DEFAULT_EMAIL}", role="admin".`)
  process.exit(1)
}
if (role !== 'admin' && role !== 'gate_staff') {
  console.error(`Invalid role "${role}" — use "admin" or "gate_staff".`)
  process.exit(1)
}

const env = readEnv()
const dbUrl = env.VITE_FIREBASE_DATABASE_URL
if (!dbUrl) {
  console.error('VITE_FIREBASE_DATABASE_URL is missing from .env — fill it in first (see FIREBASE_SETUP.md step 5).')
  process.exit(1)
}

const record = {
  email,
  role,
  display_name: displayName,
  active: true,
  created_at: Date.now(),
}

console.log(`\nWriting /staff/${uid} =`)
console.log(JSON.stringify(record, null, 2))
console.log('')

const url = `${dbUrl.replace(/\/$/, '')}/staff/${uid}.json`

try {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`REST write failed (${res.status}): ${body}`)
    console.error('\nIf this is a permission error, the rules are already deployed.')
    console.error('Either temporarily open /staff ".write" in the Console, or paste the')
    console.error(`JSON above into the Console by hand at /staff/${uid}.`)
    process.exit(1)
  }
  console.log(`Done. /staff/${uid} is now role="${role}", active=true.`)
  console.log('Sign in with this account and you will have access.')
} catch (err) {
  console.error('Request error:', err?.message || err)
  process.exit(1)
}
