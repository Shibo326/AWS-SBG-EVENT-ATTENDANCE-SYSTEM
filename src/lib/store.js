// In-memory mock data store for the frontend prototype.
// Mirrors the multi-event structure in PROJECT_PLAN.md Section 5.4:
//   /events/{eventId}/ { meta, settings, attendees, scan_events }
//   /qr_index  (token -> {eventId, attendeeId})
// This exists so every screen is interactive without a backend. It is NOT the
// production data layer — Firebase Realtime Database replaces it later.

import { computeAttendeeTime } from './time.js'

let listeners = []
const notify = () => {
  saveDb()
  listeners.forEach((fn) => fn())
}

export function subscribe(fn) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

const rid = (p = '') => p + Math.random().toString(36).slice(2, 10)
const token = () => rid('tok_') + rid()

// ---- localStorage persistence ----------------------------------------------

const STORAGE_KEY = 'sbg_attendance_db_v1'

// saveDb is a `let` so it can be assigned after `db` is defined below,
// but notify() can still call it via closure — JS hoists the binding.
let saveDb = () => {}  // no-op until db is ready

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return null
}

// ---- seed data ---------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MIN = 60 * 1000
const now = Date.now()
const todayStart = new Date(now)
todayStart.setHours(8, 0, 0, 0)
const t0 = todayStart.getTime()

const EVENT_TYPES = {
  hackathon: { label: 'Hackathon', defaultMin: 16 * 60 },
  seminar: { label: 'Seminar', defaultMin: 3 * 60 },
  workshop: { label: 'Workshop', defaultMin: 4 * 60 + 30 },
}

function seedSeminar() {
  const eventId = 'evt_seminar'
  const windows = [{ id: rid('w_'), starts_at: t0, ends_at: t0 + 8 * HOUR, label: 'Session day' }]
  const meta = {
    id: eventId,
    name: 'AWS Cloud Foundations Seminar',
    event_type: 'seminar',
    venue: 'STI Global City — Room 501',
    description: 'Intro to AWS cloud services for STI students.',
    status: 'active',
    created_at: now - 3 * DAY,
  }
  const settings = {
    qr_valid_from: t0 - HOUR,
    qr_valid_until: t0 + 9 * HOUR,
    min_minutes_required: 3 * 60,
    active_windows: windows,
    max_session_minutes: 14 * 60,
    registration_open: true,
  }

  const people = [
    ['Juan Dela Cruz', 'juan.delacruz@student.sti.edu', 'STI Global City', 'approved'],
    ['Maria Santos', 'maria.santos@student.sti.edu', 'STI Global City', 'approved'],
    ['Angelo Reyes', 'angelo.reyes@student.sti.edu', 'STI Ortigas', 'approved'],
    ['Bea Mendoza', 'bea.mendoza@student.sti.edu', 'STI Global City', 'approved'],
    ['Carlo Villanueva', 'carlo.v@student.sti.edu', 'STI Fairview', 'approved'],
    ['Diana Cruz', 'diana.cruz@student.sti.edu', 'STI Global City', 'pending'],
    ['Enrico Bautista', 'enrico.b@student.sti.edu', 'STI Caloocan', 'pending'],
    ['Faith Aquino', 'faith.aquino@student.sti.edu', 'STI Global City', 'approved'],
  ]

  const attendees = {}
  const scan_events = {}
  const index = {}

  people.forEach((p, i) => {
    const [full_name, email, organization, status] = p
    const id = rid('att_')
    const qr = token()
    const claim = token()
    const a = {
      id,
      full_name,
      email,
      organization,
      status,
      qr_token: status === 'approved' ? qr : null,
      qr_revoked: false,
      claim_token: claim,
      consent_given: true,
      consent_at: now - 2 * DAY,
      created_at: now - 2 * DAY - i * HOUR,
      approved_at: status === 'approved' ? now - DAY : null,
    }
    attendees[id] = a
    if (a.qr_token) index[a.qr_token] = { eventId, attendeeId: id }

    // Seed scan histories that exercise the time engine's cases.
    if (status === 'approved') {
      if (i === 0) {
        // full attendance, scanned out properly
        pushScan(scan_events, id, 'in', t0 + 5 * MIN)
        pushScan(scan_events, id, 'out', t0 + 3 * HOUR + 20 * MIN)
      } else if (i === 1) {
        // left and came back (multiple sessions)
        pushScan(scan_events, id, 'in', t0 + 10 * MIN)
        pushScan(scan_events, id, 'out', t0 + HOUR)
        pushScan(scan_events, id, 'in', t0 + 90 * MIN)
        // currently inside
      } else if (i === 2) {
        // short stay, not yet eligible, currently inside
        pushScan(scan_events, id, 'in', now - 40 * MIN)
      } else if (i === 3) {
        // arrived, still inside, long enough
        pushScan(scan_events, id, 'in', t0 + 15 * MIN)
      } else if (i === 4) {
        // came, left, under threshold
        pushScan(scan_events, id, 'in', t0 + 30 * MIN)
        pushScan(scan_events, id, 'out', t0 + 90 * MIN)
      }
      // i===7 (Faith) approved but not yet arrived -> no scans
    }
  })

  return { meta, settings, attendees, scan_events, index }
}

function seedHackathon() {
  const eventId = 'evt_hack'
  const d1 = t0 + 2 * HOUR
  const windows = [
    { id: rid('w_'), starts_at: d1, ends_at: d1 + 10 * HOUR, label: 'Day 1' },
    { id: rid('w_'), starts_at: d1 + DAY, ends_at: d1 + DAY + 12 * HOUR, label: 'Day 2' },
  ]
  const meta = {
    id: eventId,
    name: 'BITSKWELA Hackathon 2026',
    event_type: 'hackathon',
    venue: 'STI Global City — Innovation Hall',
    description: '2-day student hackathon.',
    status: 'active',
    created_at: now - 5 * DAY,
  }
  const settings = {
    qr_valid_from: d1 - HOUR,
    qr_valid_until: d1 + DAY + 13 * HOUR,
    min_minutes_required: 16 * 60,
    active_windows: windows,
    max_session_minutes: 14 * 60,
    registration_open: true,
  }
  const attendees = {}
  const scan_events = {}
  const index = {}
  const people = [
    ['Team Nimbus — Rhen M.', 'rhen@student.sti.edu', 'STI Global City', 'approved'],
    ['Team Cirrus — Joyce L.', 'joyce.l@student.sti.edu', 'STI Global City', 'approved'],
    ['Paolo Garcia', 'paolo.g@student.sti.edu', 'STI Ortigas', 'pending'],
  ]
  people.forEach((p, i) => {
    const [full_name, email, organization, status] = p
    const id = rid('att_')
    const qr = token()
    const a = {
      id, full_name, email, organization, status,
      qr_token: status === 'approved' ? qr : null,
      qr_revoked: false, claim_token: token(),
      consent_given: true, consent_at: now - 4 * DAY,
      created_at: now - 4 * DAY, approved_at: status === 'approved' ? now - 3 * DAY : null,
    }
    attendees[id] = a
    if (a.qr_token) index[a.qr_token] = { eventId, attendeeId: id }
    if (i === 0) pushScan(scan_events, id, 'in', d1 + 10 * MIN)
  })
  return { meta, settings, attendees, scan_events, index }
}

function pushScan(scan_events, attendee_id, direction, scanned_at, extra = {}) {
  const id = rid('scan_')
  scan_events[id] = {
    id, attendee_id, direction, outcome: 'accepted', method: 'qr',
    scanned_at, gate_id: 'gate-1', scanned_by: 'staff-demo', ...extra,
  }
  return id
}

// ---- database --------------------------------------------------------------

const seminar = seedSeminar()
const hack = seedHackathon()

const seedDb = {
  events: {
    evt_seminar: {
      meta: seminar.meta, settings: seminar.settings,
      attendees: seminar.attendees, scan_events: seminar.scan_events,
    },
    evt_hack: {
      meta: hack.meta, settings: hack.settings,
      attendees: hack.attendees, scan_events: hack.scan_events,
    },
  },
  qr_index: { ...seminar.index, ...hack.index },
}

const db = loadDb() || seedDb

// Now that db exists, wire up the real saveDb implementation
saveDb = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)) } catch (_) {}
}

// ---- read helpers ----------------------------------------------------------

export const eventTypeInfo = (t) => EVENT_TYPES[t] || { label: t, defaultMin: 0 }
export const eventTypes = () => Object.entries(EVENT_TYPES).map(([k, v]) => ({ key: k, ...v }))

export function listEvents() {
  return Object.values(db.events)
    .map((e) => e.meta)
    .sort((a, b) => b.created_at - a.created_at)
}

export function getEvent(eventId) {
  return db.events[eventId] || null
}

export function getSettings(eventId) {
  return db.events[eventId]?.settings || null
}

export function listAttendees(eventId) {
  const e = db.events[eventId]
  if (!e) return []
  return Object.values(e.attendees).sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export function getAttendee(eventId, attendeeId) {
  return db.events[eventId]?.attendees[attendeeId] || null
}

export function scansFor(eventId, attendeeId) {
  const e = db.events[eventId]
  if (!e) return []
  return Object.values(e.scan_events).filter((s) => s.attendee_id === attendeeId)
}

export function acceptedScansFor(eventId, attendeeId) {
  return scansFor(eventId, attendeeId).filter((s) => s.outcome === 'accepted')
}

export function allScans(eventId) {
  const e = db.events[eventId]
  if (!e) return []
  return Object.values(e.scan_events).sort((a, b) => b.scanned_at - a.scanned_at)
}

export function findByClaim(claimToken) {
  for (const [eventId, e] of Object.entries(db.events)) {
    for (const a of Object.values(e.attendees)) {
      if (a.claim_token === claimToken) return { eventId, attendee: a }
    }
  }
  return null
}

export function resolveToken(qrToken) {
  return db.qr_index[qrToken] || null
}

/** Compute derived stats for an attendee (uses the time engine). */
export function attendeeStats(eventId, attendeeId, now = Date.now()) {
  const settings = getSettings(eventId)
  // Corrections that void a scan remove it before computing; adjust_minutes is
  // applied by the time engine via the corrections argument.
  const voided = correctionsFor(eventId, attendeeId)
    .filter((c) => c.type === 'void_scan')
    .map((c) => c.target_scan_id)
  const scans = acceptedScansFor(eventId, attendeeId).filter((s) => !voided.includes(s.id))
  const corrections = correctionsFor(eventId, attendeeId)
  return computeAttendeeTime(scans, settings, now, corrections)
}

/** Whether an attendee's record has an anomaly an admin should look at. */
export function attendeeNeedsReview(eventId, attendeeId, now = Date.now()) {
  const st = attendeeStats(eventId, attendeeId, now)
  const hasOpenReview = reviewRequestsFor(eventId, attendeeId).some((r) => r.status === 'open')
  return st.capped || hasOpenReview
}

/** Live dashboard counters for an event. */
export function eventStats(eventId, now = Date.now()) {
  const attendees = listAttendees(eventId)
  const approved = attendees.filter((a) => a.status === 'approved')
  let inside = 0, eligible = 0, arrived = 0, needsReview = 0
  for (const a of approved) {
    const s = attendeeStats(eventId, a.id, now)
    if (s.isInside) inside++
    if (s.isEligible) eligible++
    if (s.entryCount > 0) arrived++
    if (attendeeNeedsReview(eventId, a.id, now)) needsReview++
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

// ---- write actions ---------------------------------------------------------

export function createEvent({ name, event_type, venue, description }) {
  const id = rid('evt_')
  const info = eventTypeInfo(event_type)
  const start = t0
  db.events[id] = {
    meta: { id, name, event_type, venue: venue || '', description: description || '', status: 'draft', created_at: Date.now() },
    settings: {
      qr_valid_from: start, qr_valid_until: start + 8 * HOUR,
      min_minutes_required: info.defaultMin,
      active_windows: [{ id: rid('w_'), starts_at: start, ends_at: start + 8 * HOUR, label: 'Session' }],
      max_session_minutes: 14 * 60, registration_open: false,
    },
    attendees: {}, scan_events: {},
  }
  notify()
  return id
}

export function updateSettings(eventId, patch) {
  const e = db.events[eventId]
  if (!e) return
  e.settings = { ...e.settings, ...patch }
  notify()
}

export function updateEventMeta(eventId, patch) {
  const e = db.events[eventId]
  if (!e) return
  e.meta = { ...e.meta, ...patch }
  notify()
}

export function registerAttendee(eventId, { full_name, email, organization }) {
  const e = db.events[eventId]
  if (!e) return { error: 'Event not found' }
  const dup = Object.values(e.attendees).find(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  )
  if (dup) return { error: 'This email is already registered for this event.' }
  const id = rid('att_')
  e.attendees[id] = {
    id, full_name, email, organization: organization || '',
    status: 'pending', qr_token: null, qr_revoked: false,
    claim_token: token(), consent_given: true, consent_at: Date.now(),
    created_at: Date.now(), approved_at: null,
  }
  notify()
  return { id, claim_token: e.attendees[id].claim_token }
}

export function approveAttendee(eventId, attendeeId) {
  const e = db.events[eventId]
  const a = e?.attendees[attendeeId]
  if (!a) return
  a.status = 'approved'
  a.approved_at = Date.now()
  a.qr_token = token()
  a.qr_revoked = false
  db.qr_index[a.qr_token] = { eventId, attendeeId }
  notify()
}

export function rejectAttendee(eventId, attendeeId) {
  const e = db.events[eventId]
  const a = e?.attendees[attendeeId]
  if (!a) return
  a.status = 'rejected'
  if (a.qr_token) delete db.qr_index[a.qr_token]
  a.qr_token = null
  notify()
}

/**
 * Process a scan by QR token (mirrors Module 4 sequence). Returns an outcome
 * object the scanner UI renders. Applies a 5s cooldown and derives direction
 * from current session state.
 */
export function processScan(qrToken, now = Date.now()) {
  const ref = resolveToken(qrToken)
  if (!ref) return { outcome: 'rejected_invalid', message: 'Invalid QR — not recognized', decodedToken: qrToken }
  const { eventId, attendeeId } = ref
  const e = db.events[eventId]
  const a = e.attendees[attendeeId]
  if (!a) return { outcome: 'rejected_invalid', message: 'Invalid QR' }
  if (a.qr_revoked) return { outcome: 'rejected_revoked', message: 'QR no longer valid', attendee: a }
  if (a.status !== 'approved') return { outcome: 'rejected_not_approved', message: 'Not approved', attendee: a }

  const settings = e.settings
  if (now < settings.qr_valid_from || now > settings.qr_valid_until) {
    logScan(eventId, attendeeId, 'in', 'rejected_expired', now)
    return { outcome: 'rejected_expired', message: 'QR expired — outside event window', attendee: a }
  }

  // 5-second cooldown
  const recent = scansFor(eventId, attendeeId)
    .filter((s) => s.outcome === 'accepted')
    .sort((x, y) => y.scanned_at - x.scanned_at)[0]
  if (recent && now - recent.scanned_at < 5000) {
    return { outcome: 'rejected_cooldown', message: 'Please wait a moment…', attendee: a }
  }

  const stats = attendeeStats(eventId, attendeeId, now)
  const direction = stats.isInside ? 'out' : 'in'
  logScan(eventId, attendeeId, direction, 'accepted', now)
  const after = attendeeStats(eventId, attendeeId, now)
  return {
    outcome: 'accepted', direction, attendee: a,
    eventId, stats: after, at: now,
    eventName: e.meta.name,
  }
}

function logScan(eventId, attendee_id, direction, outcome, scanned_at) {
  const e = db.events[eventId]
  const id = rid('scan_')
  e.scan_events[id] = {
    id, attendee_id, direction, outcome, method: 'qr',
    scanned_at, gate_id: 'gate-1', scanned_by: 'staff-demo',
  }
  notify()
  return id
}

/** For the scanner demo: pick a random approved attendee's QR to simulate a scan. */
export function anyApprovedToken(eventId) {
  const e = db.events[eventId]
  if (!e) return null
  const approved = Object.values(e.attendees).filter((a) => a.status === 'approved' && a.qr_token)
  if (!approved.length) return null
  return approved[Math.floor(Math.random() * approved.length)].qr_token
}

/** CertFlow-ready export rows: eligible attendees only, name+email (Section 10A.2). */
export function certflowRows(eventId, now = Date.now()) {
  return listAttendees(eventId)
    .filter((a) => a.status === 'approved')
    .filter((a) => attendeeStats(eventId, a.id, now).isEligible)
    .map((a) => ({ name: a.full_name, email: a.email }))
}

/** Full analytical export rows. */
export function analyticalRows(eventId, now = Date.now()) {
  return listAttendees(eventId)
    .filter((a) => a.status === 'approved')
    .map((a) => {
      const s = attendeeStats(eventId, a.id, now)
      return {
        name: a.full_name, email: a.email, organization: a.organization,
        total_minutes: s.totalMinutes, sessions: s.entryCount,
        eligible: s.isEligible ? 'yes' : 'no',
        review: s.capped ? 'capped_session' : '',
      }
    })
}

// ---- corrections (append-only) ---------------------------------------------
// Mirrors PROJECT_PLAN Section 5.4 /corrections. Never overwrites a scan; an
// admin fix is a new appended record with a required reason.

function correctionsFor(eventId, attendeeId) {
  const e = db.events[eventId]
  if (!e || !e.corrections) return []
  return Object.values(e.corrections)
    .filter((c) => c.attendee_id === attendeeId)
    .sort((a, b) => a.corrected_at - b.corrected_at)
}

export function listCorrections(eventId, attendeeId) {
  return correctionsFor(eventId, attendeeId)
}

/**
 * Append a correction. type = insert_missing_scan | void_scan | adjust_minutes.
 * `reason` is required. Returns { error } if invalid.
 */
export function addCorrection(eventId, attendeeId, { type, payload, target_scan_id, reason }) {
  const e = db.events[eventId]
  if (!e) return { error: 'Event not found' }
  if (!reason || !reason.trim()) return { error: 'A reason is required for every correction.' }
  if (!e.corrections) e.corrections = {}
  const id = rid('cor_')
  e.corrections[id] = {
    id, attendee_id: attendeeId, type,
    payload: payload || null, target_scan_id: target_scan_id || null,
    reason: reason.trim(), corrected_by: 'admin-demo', corrected_at: Date.now(),
  }
  notify()
  return { id }
}

// ---- review requests (attendee-raised dispute trail) -----------------------

function reviewRequestsFor(eventId, attendeeId) {
  const e = db.events[eventId]
  if (!e || !e.review_requests) return []
  return Object.values(e.review_requests)
    .filter((r) => r.attendee_id === attendeeId)
    .sort((a, b) => b.created_at - a.created_at)
}

export function listReviewRequests(eventId) {
  const e = db.events[eventId]
  if (!e || !e.review_requests) return []
  return Object.values(e.review_requests).sort((a, b) => b.created_at - a.created_at)
}

export function myReviewRequests(eventId, attendeeId) {
  return reviewRequestsFor(eventId, attendeeId)
}

/** Attendee raises a review from their self-service page. */
export function requestReview(eventId, attendeeId, message) {
  const e = db.events[eventId]
  if (!e) return { error: 'Event not found' }
  if (!e.review_requests) e.review_requests = {}
  const id = rid('rev_')
  e.review_requests[id] = {
    id, attendee_id: attendeeId, message: (message || '').trim(),
    status: 'open', created_at: Date.now(), resolved_at: null,
  }
  notify()
  return { id }
}

export function resolveReview(eventId, reviewId) {
  const e = db.events[eventId]
  const r = e?.review_requests?.[reviewId]
  if (!r) return
  r.status = 'resolved'
  r.resolved_at = Date.now()
  notify()
}
