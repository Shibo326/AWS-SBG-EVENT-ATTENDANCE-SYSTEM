// Time computation engine — implements PROJECT_PLAN.md Section 6.
// Pure functions: same input always yields the same output. Nothing is stored.
// All timestamps are epoch milliseconds (UTC internally); display formats to Asia/Manila.

/**
 * Minutes of [from, to] that fall inside the event's active windows.
 * Intersects the span with each window and sums the overlaps (Section 6.3).
 */
export function countableMinutes(from, to, activeWindows) {
  if (!activeWindows || activeWindows.length === 0) {
    // No windows declared -> the whole span counts (simple single-session events).
    return Math.max(0, Math.round((to - from) / 60000))
  }
  let sum = 0
  for (const w of activeWindows) {
    const start = Math.max(from, w.starts_at)
    const end = Math.min(to, w.ends_at)
    if (end > start) sum += (end - start) / 60000
  }
  return Math.round(sum)
}

/**
 * Reconstruct sessions from a chronological list of ACCEPTED scan events and
 * compute total countable time, current inside/outside state, and eligibility.
 * Mirrors the algorithm in Section 6.3, including the two "ignore" rules that
 * make a single dropped/duplicated scan non-corrupting.
 *
 * @param {Array<{direction:'in'|'out', scanned_at:number}>} scans  accepted only, any order
 * @param {{active_windows:Array, min_minutes_required:number, max_session_minutes:number}} settings
 * @param {number} now  current time in ms (defaults to Date.now)
 */
export function computeAttendeeTime(scans, settings, now = Date.now(), corrections = []) {
  // Admin-inserted missing scans join the stream as normal directional events.
  const inserted = (corrections || [])
    .filter((c) => c.type === 'insert_missing_scan' && c.payload)
    .map((c) => ({ direction: c.payload.direction, scanned_at: c.payload.timestamp, outcome: 'accepted' }))

  const events = [...(scans || []), ...inserted]
    .filter((s) => s.outcome ? s.outcome === 'accepted' : true)
    .sort((a, b) => a.scanned_at - b.scanned_at)

  const windows = settings?.active_windows || []
  const maxSession = (settings?.max_session_minutes || 14 * 60) * 60000

  const sessions = []
  let total = 0
  let open = null

  for (const e of events) {
    if (e.direction === 'in') {
      if (open === null) open = e.scanned_at
      // 'in' while already open -> ignored (cannot double-open)
    } else {
      if (open !== null) {
        const dur = countableMinutes(open, e.scanned_at, windows)
        total += dur
        sessions.push({ time_in: open, time_out: e.scanned_at, minutes: dur, live: false })
        open = null
      }
      // 'out' while not open -> ignored (cannot go negative)
    }
  }

  let isInside = false
  let capped = false
  if (open !== null) {
    isInside = true
    const windowEnd = endOfCoveringOrLastWindow(open, windows, now)
    const sessionCap = open + maxSession
    if (now > sessionCap) capped = true
    const cutoff = Math.min(now, windowEnd, sessionCap)
    const dur = countableMinutes(open, Math.max(open, cutoff), windows)
    total += dur
    sessions.push({ time_in: open, time_out: null, minutes: dur, live: true })
  }

  // Manual minute adjustments (documented admin allowances).
  const adjust = (corrections || [])
    .filter((c) => c.type === 'adjust_minutes' && c.payload)
    .reduce((sum, c) => sum + (Number(c.payload.delta_minutes) || 0), 0)
  total = Math.max(0, total + adjust)

  const required = settings?.min_minutes_required || 0
  return {
    totalMinutes: total,
    isInside,
    capped,
    sessions,
    entryCount: sessions.length,
    isEligible: total >= required && required > 0 ? true : total >= required,
    remainingMinutes: Math.max(0, required - total),
    requiredMinutes: required,
    progressPct: required > 0 ? Math.min(100, Math.round((total / required) * 100)) : 0,
  }
}

// End of the active window that covers `t`, or the last window's end if none covers it.
function endOfCoveringOrLastWindow(t, windows, now) {
  if (!windows || windows.length === 0) return now
  const sorted = [...windows].sort((a, b) => a.starts_at - b.starts_at)
  for (const w of sorted) {
    if (t >= w.starts_at && t <= w.ends_at) return w.ends_at
  }
  // Not inside any window: cap at the end of the last window that has started.
  const started = sorted.filter((w) => w.starts_at <= t)
  if (started.length) return started[started.length - 1].ends_at
  return sorted[sorted.length - 1].ends_at
}

/** Total countable hours the declared windows make available (Section 6.2). */
export function totalCountableMinutes(activeWindows) {
  if (!activeWindows || activeWindows.length === 0) return 0
  return activeWindows.reduce(
    (sum, w) => sum + Math.max(0, (w.ends_at - w.starts_at) / 60000),
    0,
  )
}

/** "2h 15m" style formatting from minutes. */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h === 0) return `${mm}m`
  if (mm === 0) return `${h}h`
  return `${h}h ${mm}m`
}

const MANILA = 'Asia/Manila'

export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('en-PH', {
    timeZone: MANILA, hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateTime(ms) {
  return new Date(ms).toLocaleString('en-PH', {
    timeZone: MANILA, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-PH', {
    timeZone: MANILA, month: 'short', day: 'numeric', year: 'numeric',
  })
}
