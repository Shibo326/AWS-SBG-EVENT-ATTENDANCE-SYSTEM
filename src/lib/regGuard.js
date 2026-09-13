// Public-registration abuse guard (PROJECT_PLAN Module 1).
//
// The plan asks for a per-IP throttle + a light CAPTCHA on the public form. A
// true per-IP throttle needs a server; this stack has none (client-only, §5.3).
// So the throttle here is a CLIENT-SIDE, per-browser rate limit via localStorage
// — an honest approximation that stops casual repeated submissions from one
// device, paired with a light human-check. It is a speed bump, not a hard
// security control; the real integrity guarantee is admin approval before any
// QR is issued (§9.1). A determined actor clearing storage is out of scope for
// a client-only build; noted as a residual limitation.

const KEY = 'sbg_reg_submits_v1'
const WINDOW_MS = 10 * 60 * 1000  // 10-minute rolling window
const MAX_IN_WINDOW = 5           // at most 5 submissions per browser per window

function readTimes() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function writeTimes(times) {
  try { localStorage.setItem(KEY, JSON.stringify(times)) } catch { /* best effort */ }
}

/** Recent submission timestamps within the rolling window. */
function recent(now = Date.now()) {
  return readTimes().filter((t) => now - t < WINDOW_MS)
}

/**
 * Whether another submission is allowed right now. Returns
 * { allowed, retryAfterMs } — retryAfterMs is how long until a slot frees up.
 */
export function canSubmit(now = Date.now()) {
  const times = recent(now)
  if (times.length < MAX_IN_WINDOW) return { allowed: true, retryAfterMs: 0 }
  const oldest = Math.min(...times)
  return { allowed: false, retryAfterMs: Math.max(0, WINDOW_MS - (now - oldest)) }
}

/** Record a successful submission against the throttle. */
export function recordSubmit(now = Date.now()) {
  const times = recent(now)
  times.push(now)
  writeTimes(times)
}

// ── light CAPTCHA (arithmetic human-check) ───────────────────────────────────
// Not cryptographic — a low-friction bot deterrent. Two small numbers to add.

/** Make a fresh challenge: { a, b, question }. The expected answer is a + b. */
export function makeChallenge() {
  const a = 1 + Math.floor(Math.random() * 8)   // 1..8
  const b = 1 + Math.floor(Math.random() * 8)
  return { a, b, question: `What is ${a} + ${b}?` }
}

/** Validate a typed answer against a challenge. */
export function checkChallenge(challenge, answer) {
  if (!challenge) return false
  return Number(answer) === challenge.a + challenge.b
}

/** Human-readable minutes for a retry-after duration. */
export function retryAfterLabel(ms) {
  const mins = Math.ceil(ms / 60000)
  return mins <= 1 ? 'a minute' : `${mins} minutes`
}
