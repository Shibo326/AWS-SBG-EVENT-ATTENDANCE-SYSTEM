// Async Firebase Realtime Database data layer.
//
// This replaces the in-memory mock in store.js with the real backend, while
// keeping the SAME derived-state guarantees (PROJECT_PLAN §5.3):
//   • Only raw facts are stored: events, settings, attendees, scan_events,
//     corrections, review_requests. NOTHING derived is written — total time,
//     current status, and eligibility are computed on read by time.js.
//   • Timestamps for scans and corrections use serverTimestamp(), never the
//     device clock (§6 / §9.3): gate phones have wrong clocks.
//   • Event data is isolated by path under /events/{eventId}/. Only /staff and
//     /qr_index are global (§5.4).
//
// Shape of an "event snapshot" (what subscribeEvent hands back) matches the old
// mock node exactly, so the pure derivation helpers below are drop-in with the
// already-tested time engine:
//   { meta, settings, attendees:{id:att}, scan_events:{id:scan},
//     corrections:{id:cor}, review_requests:{id:rev} }

import {
  ref,
  onValue,
  get,
  set,
  update,
  push,
  child,
  remove,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
} from 'firebase/database'
import { db } from './firebase.js'
import { computeAttendeeTime } from './time.js'

// ── event type metadata (mirrors store.js) ──────────────────────────────────

const EVENT_TYPES = {
  hackathon: { label: 'Hackathon', defaultMin: 16 * 60 },
  seminar: { label: 'Seminar', defaultMin: 3 * 60 },
  workshop: { label: 'Workshop', defaultMin: 4 * 60 + 30 },
}
export const eventTypeInfo = (t) => EVENT_TYPES[t] || { label: t, defaultMin: 0 }
export const eventTypes = () => Object.entries(EVENT_TYPES).map(([k, v]) => ({ key: k, ...v }))

// ── crypto-random tokens (§9.1: 128-bit, never derived) ─────────────────────
// Push IDs are used for record ids (chronological, collision-safe). QR/claim
// tokens must be unguessable, so they use crypto random, not push ids.

function randomToken(bytes = 16) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ── low-level path helpers ──────────────────────────────────────────────────

const eventRef = (eventId) => ref(db, `events/${eventId}`)
const eventsRef = () => ref(db, 'events')
const attendeesRef = (eventId) => ref(db, `events/${eventId}/attendees`)
const scansRef = (eventId) => ref(db, `events/${eventId}/scan_events`)
const correctionsRef = (eventId) => ref(db, `events/${eventId}/corrections`)
const reviewsRef = (eventId) => ref(db, `events/${eventId}/review_requests`)
const qrIndexRef = (token) => ref(db, `qr_index/${token}`)

// Normalize a RTDB object map ({pushId: {...}}) into an array with id attached.
const mapToArray = (obj) =>
  obj ? Object.entries(obj).map(([id, v]) => ({ id, ...v })) : []

// ── subscriptions (live reads) ──────────────────────────────────────────────

/**
 * Subscribe to the whole events list (meta only is what callers use, but we
 * hand back the full nodes so derived helpers can run without extra reads).
 * cb receives an array of event snapshots: [{ id, meta, settings, ... }].
 * Returns an unsubscribe function.
 */
export function subscribeEvents(cb, onError) {
  return onValue(
    eventsRef(),
    (snap) => {
      const val = snap.val() || {}
      const list = Object.entries(val)
        .map(([id, node]) => ({ id, ...node }))
        .sort((a, b) => (b.meta?.created_at || 0) - (a.meta?.created_at || 0))
      cb(list)
    },
    (err) => { if (onError) onError(err) },
  )
}

/**
 * Subscribe to a single event's full subtree. cb receives an event snapshot
 * or null if it does not exist. Returns an unsubscribe function.
 *
 * NOTE: reads the whole event node. Admin read is granted on the event's
 * children (meta/settings/attendees/scan_events/corrections) AND we rely on the
 * event node being readable to admins — see database.rules.json. onError fires
 * if the read is denied so callers can clear their loading state instead of
 * spinning forever.
 */
export function subscribeEvent(eventId, cb, onError) {
  if (!eventId) {
    cb(null)
    return () => {}
  }
  return onValue(
    eventRef(eventId),
    (snap) => {
      cb(snap.exists() ? { id: eventId, ...snap.val() } : null)
    },
    (err) => { if (onError) onError(err) },
  )
}

// ── one-time reads (§9/§11: self-service uses these to save connections) ─────

/** One-time read of a single event subtree. */
export async function fetchEvent(eventId) {
  const snap = await get(eventRef(eventId))
  return snap.exists() ? { id: eventId, ...snap.val() } : null
}

/**
 * Resolve a claim token to its event + attendee via a one-time read.
 * claim_token is not globally indexed, so this reads events and scans them.
 * Self-service is low-frequency, so a bounded scan is acceptable here.
 */
export async function findByClaim(claimToken) {
  const snap = await get(eventsRef())
  const events = snap.val() || {}
  for (const [eventId, node] of Object.entries(events)) {
    const attendees = node.attendees || {}
    for (const [attendeeId, a] of Object.entries(attendees)) {
      if (a.claim_token === claimToken) {
        return { eventId, attendeeId, attendee: { id: attendeeId, ...a } }
      }
    }
  }
  return null
}

/** Resolve a QR token to { eventId, attendeeId } via the global index (§5.4). */
export async function resolveToken(qrToken) {
  const snap = await get(qrIndexRef(qrToken))
  if (!snap.exists()) return null
  const v = snap.val()
  return { eventId: v.event_id, attendeeId: v.attendee_id }
}

// ── pure snapshot accessors (operate on a subscribeEvent snapshot) ───────────
// These take the event snapshot the component already holds — no extra I/O —
// so they are synchronous and identical in spirit to the old store getters.

export const listAttendeesFrom = (ev) =>
  mapToArray(ev?.attendees).sort((a, b) => a.full_name.localeCompare(b.full_name))

export const getAttendeeFrom = (ev, attendeeId) =>
  ev?.attendees?.[attendeeId] ? { id: attendeeId, ...ev.attendees[attendeeId] } : null

export const allScansFrom = (ev) =>
  mapToArray(ev?.scan_events).sort((a, b) => (b.scanned_at || 0) - (a.scanned_at || 0))

export const scansForFrom = (ev, attendeeId) =>
  mapToArray(ev?.scan_events).filter((s) => s.attendee_id === attendeeId)

export const acceptedScansForFrom = (ev, attendeeId) =>
  scansForFrom(ev, attendeeId).filter((s) => s.outcome === 'accepted')

export const correctionsForFrom = (ev, attendeeId) =>
  mapToArray(ev?.corrections)
    .filter((c) => c.attendee_id === attendeeId)
    .sort((a, b) => (a.corrected_at || 0) - (b.corrected_at || 0))

export const reviewRequestsForFrom = (ev, attendeeId) =>
  mapToArray(ev?.review_requests)
    .filter((r) => r.attendee_id === attendeeId)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))

export const listReviewRequestsFrom = (ev) =>
  mapToArray(ev?.review_requests).sort((a, b) => (b.created_at || 0) - (a.created_at || 0))

// ── derived state (§5.3) — computed on read, never stored ────────────────────

/**
 * Normalize a settings object read from RTDB so its active_windows is an ARRAY.
 * RTDB stores active_windows as an object map {pushId:{...}} (arrays are avoided
 * per §5.4), but time.js iterates it with for..of and expects an array. This is
 * the single conversion point so the tested time engine stays untouched.
 */
export function normalizeSettings(settings) {
  if (!settings) return settings
  const aw = settings.active_windows
  if (aw && !Array.isArray(aw)) {
    return { ...settings, active_windows: Object.entries(aw).map(([id, w]) => ({ id, ...w })) }
  }
  return settings
}

/** Derived stats for one attendee, from an event snapshot. */
export function attendeeStatsFrom(ev, attendeeId, now = Date.now()) {
  const settings = normalizeSettings(ev?.settings || null)
  const corrections = correctionsForFrom(ev, attendeeId)
  const voided = corrections
    .filter((c) => c.type === 'void_scan')
    .map((c) => c.target_scan_id)
  const scans = acceptedScansForFrom(ev, attendeeId).filter((s) => !voided.includes(s.id))
  return computeAttendeeTime(scans, settings, now, corrections)
}

/** Whether an attendee's record has an anomaly an admin should look at. */
export function attendeeNeedsReviewFrom(ev, attendeeId, now = Date.now()) {
  const st = attendeeStatsFrom(ev, attendeeId, now)
  const hasOpenReview = reviewRequestsForFrom(ev, attendeeId).some((r) => r.status === 'open')
  return st.capped || hasOpenReview
}

// ── concurrent-overlap detection (R18 / criterion 17, Module 5) ──────────────
// Cross-event, admin-side, READ-ONLY. If one EMAIL holds an open session
// (currently inside) in 2+ ACTIVE events at the same moment, that is physically
// impossible for a single person — the signal of a shared QR / proxy. We derive
// it at read time from each event's own scan data, WRITE NOTHING, introduce no
// global person record (email is the identity link, unique per event), and
// FLAG rather than block (§9.4 residual risk). Same email inside only one event
// is never flagged.

/**
 * Given the full list of event snapshots, return a lowercased Set of emails
 * that are currently "inside" (open session) in TWO OR MORE active events.
 * @param {Array} events  full event snapshots (e.g. from useEvents)
 */
export function concurrentOverlapEmails(events, now = Date.now()) {
  const insideCount = new Map()   // email -> number of active events they're inside
  for (const ev of events || []) {
    if (ev?.meta?.status !== 'active') continue
    for (const a of listAttendeesFrom(ev)) {
      if (a.status !== 'approved' || !a.email) continue
      const st = attendeeStatsFrom(ev, a.id, now)
      if (st.isInside) {
        const email = a.email.toLowerCase()
        insideCount.set(email, (insideCount.get(email) || 0) + 1)
      }
    }
  }
  const flagged = new Set()
  for (const [email, count] of insideCount) {
    if (count >= 2) flagged.add(email)
  }
  return flagged
}

/** True if this email is flagged for concurrent overlap (see above). */
export function hasConcurrentOverlap(overlapEmails, email) {
  return Boolean(email && overlapEmails && overlapEmails.has(email.toLowerCase()))
}

/** Live dashboard counters for an event snapshot. */
export function eventStatsFrom(ev, now = Date.now()) {
  const attendees = listAttendeesFrom(ev)
  const approved = attendees.filter((a) => a.status === 'approved')
  let inside = 0, eligible = 0, arrived = 0, needsReview = 0
  for (const a of approved) {
    const s = attendeeStatsFrom(ev, a.id, now)
    if (s.isInside) inside++
    if (s.isEligible) eligible++
    if (s.entryCount > 0) arrived++
    if (attendeeNeedsReviewFrom(ev, a.id, now)) needsReview++
  }
  return {
    registered: approved.length,
    pending: attendees.filter((a) => a.status === 'pending').length,
    inside,
    notArrived: approved.length - arrived,
    eligible,
    needsReview,
  }
}

/** CertFlow-ready rows: eligible approved attendees, name+email only (§10A.2). */
export function certflowRowsFrom(ev, now = Date.now()) {
  return listAttendeesFrom(ev)
    .filter((a) => a.status === 'approved')
    .filter((a) => attendeeStatsFrom(ev, a.id, now).isEligible)
    .map((a) => ({ name: a.full_name, email: a.email }))
}

/** Full analytical rows for the analytical CSV export. */
export function analyticalRowsFrom(ev, now = Date.now()) {
  return listAttendeesFrom(ev)
    .filter((a) => a.status === 'approved')
    .map((a) => {
      const s = attendeeStatsFrom(ev, a.id, now)
      return {
        name: a.full_name, email: a.email, organization: a.organization || '',
        year_section: a.year_section || '',
        total_minutes: s.totalMinutes, sessions: s.entryCount,
        eligible: s.isEligible ? 'yes' : 'no',
        review: s.capped ? 'capped_session' : '',
      }
    })
}

// ── writes ───────────────────────────────────────────────────────────────────

/** Create a new event (admin). Returns the new eventId (push key). */
export async function createEvent({ name, event_type, venue, description, created_by }) {
  const info = eventTypeInfo(event_type)
  const eventId = push(eventsRef()).key
  const start = Date.now()
  const windowId = push(child(eventRef(eventId), 'settings/active_windows')).key
  // Write via a root multi-path update so each deep path (meta, settings) is
  // evaluated against its OWN rule. The security rules grant admin .write on
  // events/$id/meta and events/$id/settings individually — NOT on the event
  // root — so a single set() on events/$id would be denied. This matches how
  // the rules are structured (§9.2).
  const updates = {}
  updates[`events/${eventId}/meta`] = {
    name,
    event_type,
    venue: venue || '',
    description: description || '',
    status: 'draft',
    created_at: serverTimestamp(),
    created_by: created_by || null,
  }
  updates[`events/${eventId}/settings`] = {
    qr_valid_from: start,
    qr_valid_until: start + 8 * 3600000,
    min_minutes_required: info.defaultMin,
    active_windows: {
      [windowId]: { starts_at: start, ends_at: start + 8 * 3600000, label: 'Session' },
    },
    max_session_minutes: 14 * 60,
    registration_open: false,
  }
  await update(ref(db), updates)
  return eventId
}

/** Merge a patch into an event's settings (admin). */
export async function updateSettings(eventId, patch) {
  await update(child(eventRef(eventId), 'settings'), patch)
}

/** Merge a patch into an event's meta (admin). */
export async function updateEventMeta(eventId, patch) {
  await update(child(eventRef(eventId), 'meta'), patch)
}

/**
 * Public registration — creates a PENDING attendee with NO QR (§9.1).
 * Duplicate email is checked client-side here; the rules also prevent a public
 * write from setting status/qr_token/etc. Returns { id, claim_token } | {error}.
 */
export async function registerAttendee(eventId, { full_name, email, organization, year_section }) {
  // Duplicate-email check (best-effort; requires read access to attendees, so
  // in production this runs after admin auth or is enforced by a separate
  // public-safe index. For the public form we attempt it and tolerate denial).
  try {
    const existing = await get(
      query(attendeesRef(eventId), orderByChild('email'), equalTo(email.toLowerCase())),
    )
    if (existing.exists()) {
      return { error: 'This email is already registered for this event.' }
    }
  } catch (_) {
    // read may be denied for public — proceed; admin will catch dupes.
  }

  const claim_token = randomToken()
  const node = push(attendeesRef(eventId))
  await set(node, {
    full_name,
    email: email.toLowerCase(),
    organization: organization || '',
    year_section: year_section || '',
    status: 'pending',
    qr_revoked: false,
    claim_token,
    consent_given: true,
    consent_at: serverTimestamp(),
    created_at: serverTimestamp(),
  })
  return { id: node.key, claim_token }
}

/**
 * Approve an attendee (admin): mint a 128-bit qr_token, write the global
 * /qr_index entry, and flip status. This is the ONLY place a qr_token and an
 * index entry are created (§9.1/§9.3). Returns { qr_token }.
 */
export async function approveAttendee(eventId, attendeeId, approvedBy) {
  const qr_token = randomToken()
  const updates = {}
  updates[`events/${eventId}/attendees/${attendeeId}/status`] = 'approved'
  updates[`events/${eventId}/attendees/${attendeeId}/qr_token`] = qr_token
  updates[`events/${eventId}/attendees/${attendeeId}/qr_revoked`] = false
  updates[`events/${eventId}/attendees/${attendeeId}/approved_at`] = serverTimestamp()
  if (approvedBy) updates[`events/${eventId}/attendees/${attendeeId}/approved_by`] = approvedBy
  updates[`qr_index/${qr_token}`] = { event_id: eventId, attendee_id: attendeeId }
  await update(ref(db), updates)
  return { qr_token }
}

/** Reject an attendee (admin): remove any qr_index entry and null the token. */
export async function rejectAttendee(eventId, attendeeId) {
  const attSnap = await get(child(attendeesRef(eventId), attendeeId))
  const a = attSnap.val()
  const updates = {}
  updates[`events/${eventId}/attendees/${attendeeId}/status`] = 'rejected'
  updates[`events/${eventId}/attendees/${attendeeId}/qr_token`] = null
  if (a?.qr_token) updates[`qr_index/${a.qr_token}`] = null
  await update(ref(db), updates)
}

/** Revoke a QR immediately (admin) without deleting the attendee (§9.1). */
export async function revokeAttendee(eventId, attendeeId) {
  const attSnap = await get(child(attendeesRef(eventId), attendeeId))
  const a = attSnap.val()
  const updates = {}
  updates[`events/${eventId}/attendees/${attendeeId}/qr_revoked`] = true
  if (a?.qr_token) updates[`qr_index/${a.qr_token}`] = null
  await update(ref(db), updates)
}

/**
 * Append a scan event (append-only, §9.2). scanned_at is a SERVER timestamp so
 * a client cannot backdate it (§9.3). Returns the scan's push key.
 */
export async function appendScan(eventId, { attendee_id, direction, outcome, method, gate_id, scanned_by }) {
  const node = push(scansRef(eventId))
  await set(node, {
    attendee_id: attendee_id ?? null,
    direction,
    outcome,
    method: method || 'qr',
    scanned_at: serverTimestamp(),
    gate_id: gate_id || 'gate-1',
    scanned_by: scanned_by || 'unknown',
  })
  return node.key
}

/**
 * Append a correction (append-only, §5.4). `reason` is required. corrected_at
 * is a server timestamp. Returns { id } | { error }.
 */
export async function addCorrection(eventId, attendeeId, { type, payload, target_scan_id, reason, corrected_by }) {
  if (!reason || !reason.trim()) {
    return { error: 'A reason is required for every correction.' }
  }
  const node = push(correctionsRef(eventId))
  await set(node, {
    attendee_id: attendeeId,
    type,
    payload: payload || null,
    target_scan_id: target_scan_id || null,
    reason: reason.trim(),
    corrected_by: corrected_by || 'admin',
    corrected_at: serverTimestamp(),
  })
  return { id: node.key }
}

/** Attendee raises a review from self-service. Returns { id }. */
export async function requestReview(eventId, attendeeId, message) {
  const node = push(reviewsRef(eventId))
  await set(node, {
    attendee_id: attendeeId,
    message: (message || '').trim(),
    status: 'open',
    created_at: serverTimestamp(),
    resolved_at: null,
  })
  return { id: node.key }
}

/** Admin resolves a review request. */
export async function resolveReview(eventId, reviewId) {
  await update(child(reviewsRef(eventId), reviewId), {
    status: 'resolved',
    resolved_at: serverTimestamp(),
  })
}

/** Archive / unarchive (reversible) an event by setting its status (§Module 0). */
export async function setEventStatus(eventId, status) {
  await update(child(eventRef(eventId), 'meta'), { status })
}

/**
 * Process a QR scan (Module 4 sequence, §7). Async because it reads the index,
 * the event, and the attendee's recent scans, then appends a scan event.
 *
 * Steps:
 *   1. Resolve the token via /qr_index → event + attendee (§5.4).
 *   2. Reject invalid / revoked / not-approved / expired (each logged where the
 *      plan says to log it).
 *   3. 5-second cooldown per token (§7): a camera fires several times a second;
 *      without this, one presentation registers IN then OUT and freezes time.
 *   4. Derive direction from current session state (inside → out, else in).
 *   5. Append the scan with a SERVER timestamp (§9.3).
 *
 * Returns an outcome object the scanner UI renders. Never throws; on infra
 * error it returns a rejection so the gate keeps moving.
 *
 * @param {string} qrToken  decoded QR contents
 * @param {object} [opts]   { gateId, scannedBy, method }
 */
export async function processScan(qrToken, opts = {}) {
  const { gateId = 'gate-1', scannedBy = 'staff', method = 'qr' } = opts
  const now = Date.now()
  try {
    const ref_ = await resolveToken(qrToken)
    if (!ref_) {
      return { outcome: 'rejected_invalid', message: 'Invalid QR — not recognized', decodedToken: qrToken }
    }
    const { eventId, attendeeId } = ref_
    const ev = await fetchEvent(eventId)
    const a = ev?.attendees?.[attendeeId] ? { id: attendeeId, ...ev.attendees[attendeeId] } : null
    if (!ev || !a) return { outcome: 'rejected_invalid', message: 'Invalid QR' }

    // Rejected scans ARE stored per event (§5.4) — the log must be able to
    // answer "I scanned, why do I have no time?". Every rejection below that
    // resolved to an event is appended before returning. (A token that matched
    // nothing in /qr_index has no event path, so it cannot be filed per-event;
    // that is the one rejection we can only surface in the UI, not persist.)

    if (a.qr_revoked) {
      await appendScan(eventId, {
        attendee_id: attendeeId, direction: 'in', outcome: 'rejected_revoked',
        method, gate_id: gateId, scanned_by: scannedBy,
      })
      return { outcome: 'rejected_revoked', message: 'QR no longer valid', attendee: a }
    }
    if (a.status !== 'approved') {
      await appendScan(eventId, {
        attendee_id: attendeeId, direction: 'in', outcome: 'rejected_not_approved',
        method, gate_id: gateId, scanned_by: scannedBy,
      })
      return { outcome: 'rejected_not_approved', message: 'Not approved', attendee: a }
    }

    const settings = ev.settings || {}
    if (now < settings.qr_valid_from || now > settings.qr_valid_until) {
      await appendScan(eventId, {
        attendee_id: attendeeId, direction: 'in', outcome: 'rejected_expired',
        method, gate_id: gateId, scanned_by: scannedBy,
      })
      return { outcome: 'rejected_expired', message: 'QR expired — outside event window', attendee: a }
    }

    // 5-second cooldown per token.
    const recent = acceptedScansForFrom(ev, attendeeId)
      .sort((x, y) => (y.scanned_at || 0) - (x.scanned_at || 0))[0]
    if (recent && now - (recent.scanned_at || 0) < 5000) {
      await appendScan(eventId, {
        attendee_id: attendeeId, direction: 'in', outcome: 'rejected_cooldown',
        method, gate_id: gateId, scanned_by: scannedBy,
      })
      return { outcome: 'rejected_cooldown', message: 'Please wait a moment…', attendee: a }
    }

    // Derive direction from current session state.
    const before = attendeeStatsFrom(ev, attendeeId, now)
    const direction = before.isInside ? 'out' : 'in'
    await appendScan(eventId, {
      attendee_id: attendeeId, direction, outcome: 'accepted',
      method, gate_id: gateId, scanned_by: scannedBy,
    })

    // Re-read this event to derive the post-scan stats for the confirmation UI.
    const evAfter = await fetchEvent(eventId)
    const stats = attendeeStatsFrom(evAfter, attendeeId, now)
    return { outcome: 'accepted', direction, attendee: a, eventId, stats, at: now, eventName: ev.meta?.name }
  } catch (err) {
    return { outcome: 'rejected_invalid', message: 'Scan failed — please try again', decodedToken: qrToken }
  }
}

/** Pick a random approved attendee's QR token for the scanner's Simulate button. */
export function anyApprovedTokenFrom(ev) {
  const approved = listAttendeesFrom(ev).filter((a) => a.status === 'approved' && a.qr_token)
  if (!approved.length) return null
  return approved[Math.floor(Math.random() * approved.length)].qr_token
}

/**
 * Persist ONE buffered offline scan (from scanQueue) preserving its original
 * client timestamp (R3 / criterion 13). Because the security rules force a
 * server timestamp on normal scan_events, an offline scan — which happened in
 * the past — is written instead as an `insert_missing_scan` CORRECTION whose
 * payload carries the captured client time. The time engine already applies
 * these corrections, so the attendee's total reflects the real moment they
 * scanned, not the sync moment. Direction is derived from state at the captured
 * time. The clientId is embedded in the reason so the write is auditable and
 * dedup-traceable. Throws on failure so the queue keeps the item for retry.
 *
 * @param {{clientId, token, gateId, scannedBy, clientTs}} item
 */
export async function syncOfflineScan(item) {
  const ref_ = await resolveToken(item.token)
  if (!ref_) {
    // Token matched nothing — nothing to file per-event. Treat as handled so it
    // doesn't wedge the queue forever (an invalid QR offline is unrecoverable).
    return { skipped: true }
  }
  const { eventId, attendeeId } = ref_
  const ev = await fetchEvent(eventId)
  if (!ev?.attendees?.[attendeeId]) return { skipped: true }

  // Derive direction from the attendee's state AS OF the captured time, so a
  // buffered in/out sequence reconstructs correctly regardless of sync order.
  const stateThen = attendeeStatsFrom(ev, attendeeId, item.clientTs)
  const direction = stateThen.isInside ? 'out' : 'in'

  const res = await addCorrection(eventId, attendeeId, {
    type: 'insert_missing_scan',
    payload: { direction, timestamp: item.clientTs },
    reason: `Offline scan synced on reconnect (gate ${item.gateId}, ref ${item.clientId})`,
    corrected_by: item.scannedBy || 'scanner',
  })
  if (res.error) throw new Error(res.error)
  return { eventId, attendeeId, direction }
}
