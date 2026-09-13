// Tests for the public-registration abuse guard (Module 1): the per-browser
// throttle and the light arithmetic CAPTCHA.

import { describe, it, expect, beforeEach } from 'vitest'
import { canSubmit, recordSubmit, makeChallenge, checkChallenge, retryAfterLabel } from './regGuard.js'

beforeEach(() => {
  localStorage.clear()
})

describe('registration throttle', () => {
  it('allows submissions under the limit', () => {
    expect(canSubmit().allowed).toBe(true)
    recordSubmit()
    recordSubmit()
    expect(canSubmit().allowed).toBe(true)
  })

  it('blocks after the max in the window and reports a retry delay', () => {
    for (let i = 0; i < 5; i++) recordSubmit()
    const gate = canSubmit()
    expect(gate.allowed).toBe(false)
    expect(gate.retryAfterMs).toBeGreaterThan(0)
  })

  it('frees up once old submissions age out of the window', () => {
    const old = Date.now() - 11 * 60 * 1000 // older than the 10-min window
    for (let i = 0; i < 5; i++) recordSubmit(old)
    // All recorded times are outside the window now, so a fresh check allows.
    expect(canSubmit(Date.now()).allowed).toBe(true)
  })
})

describe('light CAPTCHA', () => {
  it('accepts the correct sum', () => {
    const c = makeChallenge()
    expect(checkChallenge(c, c.a + c.b)).toBe(true)
    expect(checkChallenge(c, String(c.a + c.b))).toBe(true) // string input from an <input>
  })

  it('rejects a wrong answer and a null challenge', () => {
    const c = makeChallenge()
    expect(checkChallenge(c, c.a + c.b + 1)).toBe(false)
    expect(checkChallenge(null, 5)).toBe(false)
  })

  it('produces a challenge with a stable question string', () => {
    const c = makeChallenge()
    expect(c.question).toContain(String(c.a))
    expect(c.question).toContain(String(c.b))
  })
})

describe('retryAfterLabel', () => {
  it('formats minutes', () => {
    expect(retryAfterLabel(30 * 1000)).toBe('a minute')
    expect(retryAfterLabel(5 * 60 * 1000)).toBe('5 minutes')
  })
})
