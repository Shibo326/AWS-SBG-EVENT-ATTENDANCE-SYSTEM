// Tests for the EmailJS module's contract. Env vars are unset under Vitest, so
// this proves the graceful no-op path: the app must run and approvals must
// proceed even when EmailJS is not configured (email is a convenience channel,
// self-service is the guaranteed fallback — PROJECT_PLAN §4 / §12.12).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isEmailConfigured,
  sendQrTicket,
  claimUrl,
  renderQrDataUrl,
} from './email.js'

// The unconfigured path must hold regardless of what's in the developer's local
// .env, so we stub the EmailJS env vars to empty for these tests (email.js reads
// them at call time). This proves the graceful no-op: approvals proceed even
// when EmailJS is not configured (self-service is the fallback — §4 / §12.12).
describe('email module — unconfigured behavior', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '')
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '')
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports not configured when VITE_EMAILJS_* are unset', () => {
    expect(isEmailConfigured()).toBe(false)
  })

  it('sendQrTicket skips (does not throw) when unconfigured', async () => {
    const r = await sendQrTicket({
      toEmail: 'student@example.com',
      toName: 'Test Student',
      eventName: 'Demo Event',
      qrToken: 'tok_abc123',
    })
    expect(r.sent).toBe(false)
    expect(r.skipped).toBe(true)
    expect(r.reason).toMatch(/not configured/i)
  })

  it('reports configured when all three keys are present', () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service_x')
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template_x')
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'pub_x')
    expect(isEmailConfigured()).toBe(true)
  })
})

describe('email module — pure helpers', () => {
  it('builds a self-service claim URL', () => {
    // jsdom sets window.location.origin to http://localhost:3000 by default
    expect(claimUrl('claim_xyz')).toContain('/me/claim_xyz')
  })

  it('renders a QR token to a PNG data URL', async () => {
    const url = await renderQrDataUrl('tok_abc123', 128)
    expect(url).toMatch(/^data:image\/png;base64,/)
  })
})
