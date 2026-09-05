// Tests for concurrent-overlap detection (PROJECT_PLAN R18 / criterion 17).
// An email with an OPEN session (inside) in 2+ ACTIVE events at once is flagged;
// the same email inside only one event is not. Read-only, derived — no writes.
//
// These build synthetic event snapshots shaped like a subscribeEvent() result
// so we exercise the real derivation (which runs the time engine per event).

import { describe, it, expect } from 'vitest'
import { concurrentOverlapEmails, hasConcurrentOverlap } from './db.js'

const HOUR = 3600000
const now = Date.parse('2026-09-16T12:00:00+08:00')
const win = (fromMs, toMs) => ({ w1: { starts_at: fromMs, ends_at: toMs, label: 'day' } })

// Build an event snapshot with one approved attendee and a scan history.
// `scans` is an array of ['in'|'out', epochMs].
function makeEvent(id, status, email, scans) {
  const scan_events = {}
  scans.forEach(([direction, at], i) => {
    scan_events[`s${i}`] = {
      attendee_id: 'att1', direction, outcome: 'accepted',
      method: 'qr', scanned_at: at, gate_id: 'g', scanned_by: 'u',
    }
  })
  return {
    id,
    meta: { name: id, status },
    settings: {
      active_windows: win(now - 6 * HOUR, now + 6 * HOUR),
      min_minutes_required: 60,
      max_session_minutes: 14 * 60,
    },
    attendees: { att1: { full_name: 'Test', email, status: 'approved' } },
    scan_events,
  }
}

describe('concurrentOverlapEmails', () => {
  it('flags an email inside two active events at once', () => {
    const events = [
      makeEvent('E1', 'active', 'proxy@sti.edu', [['in', now - 2 * HOUR]]), // open
      makeEvent('E2', 'active', 'proxy@sti.edu', [['in', now - 1 * HOUR]]), // open
    ]
    const flagged = concurrentOverlapEmails(events, now)
    expect(flagged.has('proxy@sti.edu')).toBe(true)
  })

  it('does NOT flag an email inside only one event', () => {
    const events = [
      makeEvent('E1', 'active', 'honest@sti.edu', [['in', now - 2 * HOUR]]),        // open
      makeEvent('E2', 'active', 'honest@sti.edu', [['in', now - 3 * HOUR], ['out', now - 2 * HOUR]]), // closed
    ]
    const flagged = concurrentOverlapEmails(events, now)
    expect(flagged.has('honest@sti.edu')).toBe(false)
  })

  it('ignores non-active events (only concurrent ACTIVE events count)', () => {
    const events = [
      makeEvent('E1', 'active', 'x@sti.edu', [['in', now - 2 * HOUR]]),
      makeEvent('E2', 'ended', 'x@sti.edu', [['in', now - 1 * HOUR]]), // ended — not counted
    ]
    const flagged = concurrentOverlapEmails(events, now)
    expect(flagged.has('x@sti.edu')).toBe(false)
  })

  it('matches email case-insensitively', () => {
    const events = [
      makeEvent('E1', 'active', 'Case@STI.edu', [['in', now - 2 * HOUR]]),
      makeEvent('E2', 'active', 'case@sti.edu', [['in', now - 1 * HOUR]]),
    ]
    const flagged = concurrentOverlapEmails(events, now)
    expect(hasConcurrentOverlap(flagged, 'CASE@sti.edu')).toBe(true)
  })

  it('clearing the overlap in one event removes the flag (criterion 17)', () => {
    // Same as the flagged case, but the attendee scanned OUT of E2.
    const events = [
      makeEvent('E1', 'active', 'proxy@sti.edu', [['in', now - 2 * HOUR]]),         // still open
      makeEvent('E2', 'active', 'proxy@sti.edu', [['in', now - 2 * HOUR], ['out', now - 1 * HOUR]]), // closed
    ]
    const flagged = concurrentOverlapEmails(events, now)
    expect(flagged.has('proxy@sti.edu')).toBe(false)
  })

  it('returns an empty set for no events', () => {
    expect(concurrentOverlapEmails([], now).size).toBe(0)
    expect(concurrentOverlapEmails(null, now).size).toBe(0)
  })
})
