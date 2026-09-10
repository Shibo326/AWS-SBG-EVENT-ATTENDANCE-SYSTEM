// Time-engine unit suite — proves PROJECT_PLAN.md Section 6 and the acceptance
// criteria that depend on time math (§12: 3, 4, 5, 6, 9). The time engine
// decides who gets a certificate, so it is proven before any UI consumes it.
//
// All timestamps are absolute epoch ms. We build them from a fixed anchor so
// the tests are deterministic and independent of the machine clock / timezone.

import { describe, it, expect } from 'vitest'
import {
  computeAttendeeTime,
  countableMinutes,
  totalCountableMinutes,
  formatDuration,
} from './time.js'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// Fixed anchor: 2026-09-16 08:00:00 +08:00 -> as UTC ms. Using an explicit
// offset keeps the math independent of the runner's local timezone.
const ANCHOR = Date.parse('2026-09-16T08:00:00+08:00')
const at = (ms) => ANCHOR + ms

const scan = (direction, whenMs, outcome = 'accepted') => ({
  direction,
  scanned_at: at(whenMs),
  outcome,
})

// A single active window: 08:00 -> 20:00 (12h) on day 1.
const oneDayWindow = () => [
  { starts_at: at(0), ends_at: at(12 * HOUR), label: 'Day' },
]

// Three-day hackathon windows from the plan's example (Section 6.2):
// Day1 10:00-22:00 (12h), Day2 08:00-22:00 (14h), Day3 08:00-22:00 (14h) = 40h.
const hackWindows = () => {
  const d1_10 = at(2 * HOUR)          // anchor is 08:00, +2h = 10:00
  return [
    { starts_at: d1_10, ends_at: d1_10 + 12 * HOUR, label: 'Day 1' },
    { starts_at: d1_10 + DAY - 2 * HOUR, ends_at: d1_10 + DAY - 2 * HOUR + 14 * HOUR, label: 'Day 2' },
    { starts_at: d1_10 + 2 * DAY - 2 * HOUR, ends_at: d1_10 + 2 * DAY - 2 * HOUR + 14 * HOUR, label: 'Day 3' },
  ]
}

const settings = (over = {}) => ({
  active_windows: oneDayWindow(),
  min_minutes_required: 3 * 60,
  max_session_minutes: 14 * 60,
  ...over,
})

describe('countableMinutes', () => {
  it('counts the whole span when no windows are declared (simple events)', () => {
    expect(countableMinutes(at(0), at(2 * HOUR), [])).toBe(120)
    expect(countableMinutes(at(0), at(2 * HOUR), null)).toBe(120)
  })

  it('credits only the overlap with a single active window', () => {
    // span 06:00 -> 10:00, window 08:00 -> 20:00 => only 08:00-10:00 = 120m
    const w = oneDayWindow()
    expect(countableMinutes(at(-2 * HOUR), at(2 * HOUR), w)).toBe(120)
  })

  it('sums overlaps across multiple windows and excludes the gap between them', () => {
    // span crosses the day1->day2 overnight gap; overnight must not count.
    const w = hackWindows()
    // from day1 10:00 straight through to day2 14:00 (spanning the overnight gap)
    const from = at(2 * HOUR)                  // day1 10:00
    const to = at(2 * HOUR + DAY + 4 * HOUR)   // anchor + 30h = day2 14:00
    // day1 contributes 12h (10:00-22:00), day2 contributes 6h (08:00-14:00) = 18h.
    // The overnight gap (22:00 day1 -> 08:00 day2) is excluded.
    expect(countableMinutes(from, to, w)).toBe(18 * 60)
  })

  it('returns 0 when the span is entirely outside every window', () => {
    const w = oneDayWindow()
    expect(countableMinutes(at(13 * HOUR), at(15 * HOUR), w)).toBe(0)
  })
})

describe('totalCountableMinutes', () => {
  it('sums the declared window lengths (Section 6.2 example = 40h)', () => {
    expect(totalCountableMinutes(hackWindows())).toBe(40 * 60)
  })
  it('is 0 with no windows', () => {
    expect(totalCountableMinutes([])).toBe(0)
    expect(totalCountableMinutes(null)).toBe(0)
  })
})

describe('computeAttendeeTime — basic sessions', () => {
  it('credits a single in/out pair inside the window', () => {
    const scans = [scan('in', 0), scan('out', 2 * HOUR)]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(120)
    expect(r.isInside).toBe(false)
    expect(r.entryCount).toBe(1)
  })

  it('sums three separate visits = sum of countable portions (§12.4)', () => {
    const scans = [
      scan('in', 0), scan('out', 1 * HOUR),          // 60m
      scan('in', 2 * HOUR), scan('out', 3 * HOUR),   // 60m
      scan('in', 4 * HOUR), scan('out', 4 * HOUR + 30 * MIN), // 30m
    ]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(150) // 2h30m, verifiable by hand
    expect(r.entryCount).toBe(3)
    expect(r.isInside).toBe(false)
  })
})

describe('computeAttendeeTime — the two ignore rules (§6.3)', () => {
  it('ignores a duplicate "in" while already open (cannot double-open)', () => {
    const scans = [
      scan('in', 0),
      scan('in', 30 * MIN),   // duplicate — ignored
      scan('out', 2 * HOUR),
    ]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(120) // counted from the first "in" only
    expect(r.entryCount).toBe(1)
  })

  it('ignores an "out" with no matching "in" (cannot go negative)', () => {
    const scans = [
      scan('out', 30 * MIN),  // stray out — ignored
      scan('in', 1 * HOUR),
      scan('out', 2 * HOUR),
    ]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(60)
    expect(r.totalMinutes).toBeGreaterThanOrEqual(0)
  })

  it('a single dropped/duplicated scan does not corrupt later sessions', () => {
    const scans = [
      scan('in', 0), scan('in', 10 * MIN), // glitch
      scan('out', 1 * HOUR),
      scan('in', 2 * HOUR), scan('out', 3 * HOUR), // clean later session still correct
    ]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(120) // 60 + 60
  })
})

describe('computeAttendeeTime — still inside (live timer)', () => {
  it('runs a live timer to now, bounded by the window', () => {
    const scans = [scan('in', 0)] // no out
    const now = at(2 * HOUR)
    const r = computeAttendeeTime(scans, settings(), now)
    expect(r.isInside).toBe(true)
    expect(r.totalMinutes).toBe(120)
    expect(r.sessions.at(-1).live).toBe(true)
  })

  it('closes an open session at the active window end when now is past it (§12.6)', () => {
    // in at 08:00, still open, now is 23:00 — window ends 20:00 => 12h credited
    const scans = [scan('in', 0)]
    const now = at(15 * HOUR) // 23:00, well past the 20:00 window end
    const r = computeAttendeeTime(scans, settings(), now)
    expect(r.totalMinutes).toBe(12 * 60)
    expect(r.isInside).toBe(true)
  })

  it('overnight without scan-out credits only time inside active windows (§12.5)', () => {
    // Hackathon: in at day1 10:00, never scans out, now = day2 09:00.
    // Per §6.4 ("session closes at the active window's end"), an open session
    // that runs past its covering window closes at that window's end — it does
    // NOT silently resume in the next day's window. So only day1's 12h counts,
    // NOT the ~23h of raw elapsed time. This is the overnight-inflation fix.
    const w = hackWindows()
    const inAt = w[0].starts_at            // day1 10:00
    const now = w[1].starts_at + 1 * HOUR  // day2 09:00
    const scans = [{ direction: 'in', scanned_at: inAt, outcome: 'accepted' }]
    const r = computeAttendeeTime(
      scans,
      settings({ active_windows: w, min_minutes_required: 16 * 60 }),
      now,
    )
    expect(r.totalMinutes).toBe(12 * 60) // day1 10:00-22:00 only
  })
})

describe('computeAttendeeTime — max session cap', () => {
  it('caps an over-long open session and flags it for review', () => {
    // Window is 12h but cap is 6h. In at 08:00, now 20:00 -> capped at 6h.
    const scans = [scan('in', 0)]
    const now = at(12 * HOUR)
    const r = computeAttendeeTime(
      scans,
      settings({ max_session_minutes: 6 * 60 }),
      now,
    )
    expect(r.totalMinutes).toBe(6 * 60)
    expect(r.capped).toBe(true)
  })

  it('does not flag capped when the session is within the cap', () => {
    const scans = [scan('in', 0)]
    const r = computeAttendeeTime(scans, settings(), at(2 * HOUR))
    expect(r.capped).toBe(false)
  })
})

describe('computeAttendeeTime — rejected scans are excluded', () => {
  it('ignores scans whose outcome is not accepted', () => {
    const scans = [
      scan('in', 0),
      scan('out', 1 * HOUR),
      { direction: 'in', scanned_at: at(2 * HOUR), outcome: 'rejected_expired' },
    ]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(60)
    expect(r.isInside).toBe(false) // the rejected "in" must not open a session
  })
})

describe('computeAttendeeTime — eligibility', () => {
  it('is eligible when total meets the threshold', () => {
    const scans = [scan('in', 0), scan('out', 3 * HOUR)]
    const r = computeAttendeeTime(scans, settings({ min_minutes_required: 180 }), at(6 * HOUR))
    expect(r.isEligible).toBe(true)
    expect(r.remainingMinutes).toBe(0)
    expect(r.progressPct).toBe(100)
  })

  it('is not eligible below the threshold and reports remaining minutes', () => {
    const scans = [scan('in', 0), scan('out', 2 * HOUR)]
    const r = computeAttendeeTime(scans, settings({ min_minutes_required: 180 }), at(6 * HOUR))
    expect(r.isEligible).toBe(false)
    expect(r.remainingMinutes).toBe(60)
    expect(r.progressPct).toBe(67) // 120/180
  })

  it('re-evaluates when the admin lowers the threshold, no migration (§12.9)', () => {
    const scans = [scan('in', 0), scan('out', 2 * HOUR)] // 120m
    const strict = computeAttendeeTime(scans, settings({ min_minutes_required: 180 }), at(6 * HOUR))
    const relaxed = computeAttendeeTime(scans, settings({ min_minutes_required: 120 }), at(6 * HOUR))
    expect(strict.isEligible).toBe(false)
    expect(relaxed.isEligible).toBe(true) // same scans, just a different threshold on read
  })
})

describe('computeAttendeeTime — corrections (append-only, §5.4)', () => {
  it('applies an inserted missing scan as a normal directional event', () => {
    // Attendee forgot to scan in; admin inserts an "in" at 08:00.
    const scans = [scan('out', 2 * HOUR)]
    const corrections = [
      {
        type: 'insert_missing_scan',
        payload: { direction: 'in', timestamp: at(0) },
      },
    ]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR), corrections)
    expect(r.totalMinutes).toBe(120)
  })

  it('applies an adjust_minutes correction to the total', () => {
    const scans = [scan('in', 0), scan('out', 2 * HOUR)] // 120m
    const corrections = [{ type: 'adjust_minutes', payload: { delta_minutes: 30 } }]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR), corrections)
    expect(r.totalMinutes).toBe(150)
  })

  it('never lets an adjustment drive the total negative', () => {
    const scans = [scan('in', 0), scan('out', 1 * HOUR)] // 60m
    const corrections = [{ type: 'adjust_minutes', payload: { delta_minutes: -999 } }]
    const r = computeAttendeeTime(scans, settings(), at(6 * HOUR), corrections)
    expect(r.totalMinutes).toBe(0)
  })
})

describe('computeAttendeeTime — empty / degenerate input', () => {
  it('returns a zeroed result for no scans (approved but not arrived)', () => {
    const r = computeAttendeeTime([], settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(0)
    expect(r.isInside).toBe(false)
    expect(r.entryCount).toBe(0)
    expect(r.isEligible).toBe(false)
  })

  it('tolerates null scans', () => {
    const r = computeAttendeeTime(null, settings(), at(6 * HOUR))
    expect(r.totalMinutes).toBe(0)
  })
})

describe('formatDuration', () => {
  it('formats minutes into h/m parts', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(135)).toBe('2h 15m')
  })
})
