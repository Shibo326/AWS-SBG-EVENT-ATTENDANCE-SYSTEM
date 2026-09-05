// Security-rules invariant tests for database.rules.json.
//
// The gold-standard way to test RTDB rules is @firebase/rules-unit-testing
// against the Firebase emulator (which needs Java + the emulator installed).
// That is the right tool for a full behavioral suite and should be added when
// the emulator is available locally / in CI. See the note at the bottom.
//
// Until then, these tests parse the rules JSON and assert the load-bearing
// invariants from PROJECT_PLAN §9 structurally, so a regression that weakens a
// critical rule (e.g. making /attendees publicly readable) fails the build.
// This is a real, runnable guardrail with zero extra dependencies.

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
let rules

beforeAll(() => {
  const raw = readFileSync(join(here, 'database.rules.json'), 'utf8')
  rules = JSON.parse(raw).rules
})

describe('database.rules.json — parses and locks the tree down by default', () => {
  it('is valid JSON with a top-level rules object', () => {
    expect(rules).toBeTypeOf('object')
  })

  it('denies read and write at the root by default (§9 default-deny)', () => {
    expect(rules['.read']).toBe(false)
    expect(rules['.write']).toBe(false)
  })
})

describe('§12.2 — the public cannot read /attendees', () => {
  it('attendees has no public read (read is gated on an admin role check)', () => {
    const attendees = rules.events.$eventId.attendees
    // Must NOT be the boolean true, and must reference an admin role gate.
    expect(attendees['.read']).not.toBe(true)
    expect(typeof attendees['.read']).toBe('string')
    expect(attendees['.read']).toContain('admin')
    expect(attendees['.read']).toContain('auth != null')
  })

  it('a single attendee node is not publicly readable either', () => {
    const one = rules.events.$eventId.attendees.$attendeeId
    expect(one['.read']).not.toBe(true)
    expect(one['.read']).toContain('admin')
  })
})

describe('§9.2 — public may create a pending registration but not self-approve', () => {
  it('allows an anonymous create only when the node does not yet exist', () => {
    const write = rules.events.$eventId.attendees.$attendeeId['.write']
    expect(write).toContain('!data.exists()')
    expect(write).toContain('auth == null')
  })

  it('status/qr_token/claim_token are admin-write-only (§9.3)', () => {
    const node = rules.events.$eventId.attendees.$attendeeId
    for (const field of ['status', 'qr_token', 'claim_token']) {
      expect(node[field]['.write']).toContain('admin')
    }
  })

  it('consent must be explicitly true (Data Privacy Act, §10)', () => {
    const consent = rules.events.$eventId.attendees.$attendeeId.consent_given
    expect(consent['.validate']).toContain('=== true')
  })
})

describe('§9.2 — scan_events is append-only for everyone', () => {
  it('a scan can be created but never overwritten (write requires !data.exists())', () => {
    const write = rules.events.$eventId.scan_events.$scanId['.write']
    expect(write).toContain('!data.exists()')
    expect(write).toContain('newData.exists()')
  })

  it('scanned_at must equal the server timestamp (§9.3, no client clock)', () => {
    const scannedAt = rules.events.$eventId.scan_events.$scanId.scanned_at
    expect(scannedAt['.validate']).toBe('newData.val() === now')
  })

  it('outcome and direction are constrained to their allowed sets', () => {
    const node = rules.events.$eventId.scan_events.$scanId
    expect(node.direction['.validate']).toContain("'in'")
    expect(node.direction['.validate']).toContain("'out'")
    expect(node.outcome['.validate']).toContain('accepted')
    expect(node.outcome['.validate']).toContain('rejected_expired')
  })

  it('gate staff (not just admin) may append a scan', () => {
    const write = rules.events.$eventId.scan_events.$scanId['.write']
    expect(write).toContain('gate_staff')
  })
})

describe('§9.2 — corrections are admin-only and append-only', () => {
  it('correction write requires admin and a non-existing node', () => {
    const write = rules.events.$eventId.corrections.$correctionId['.write']
    expect(write).toContain('admin')
    expect(write).toContain('!data.exists()')
  })

  it('a correction reason is required (§5.4)', () => {
    const reason = rules.events.$eventId.corrections.$correctionId.reason
    expect(reason['.validate']).toContain('length > 0')
  })
})

describe('§9.2 — global nodes', () => {
  it('/qr_index is writable only by admin (§9.3, planted-index attack)', () => {
    const write = rules.qr_index.$qr_token['.write']
    expect(write).toContain('admin')
  })

  it('/qr_index is readable by staff (admin or gate_staff), not the public', () => {
    const read = rules.qr_index['.read']
    expect(read).toContain('auth != null')
    expect(read).toContain('gate_staff')
  })

  it('/staff top-level read/write is admin-only', () => {
    expect(rules.staff['.read']).toContain('admin')
    expect(rules.staff['.write']).toContain('admin')
  })
})

// ── Follow-up (documented, not yet wired) ───────────────────────────────────
// For a full behavioral suite, add @firebase/rules-unit-testing and the
// Firebase emulator, then assert with a real client that:
//   • an unauthenticated read of /events/$e/attendees is DENIED
//   • an unauthenticated create of a pending attendee is ALLOWED
//   • an unauthenticated write of status:'approved' is DENIED
//   • a gate_staff read of /events/$e/attendees is DENIED
//   • any update/delete of an existing scan_events child is DENIED (even admin)
// These structural tests guard the same invariants without the emulator.
