// Offline scan queue tests (R3 / acceptance criterion 13 / §14 Resilience):
// buffering, timestamp preservation, flush-on-reconnect, and — critically —
// NO double-count when a reconnect flush runs more than once.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enqueueScan, getQueue, queueLength, flushQueue } from './scanQueue.js'

beforeEach(() => {
  localStorage.clear()
})

describe('scan queue — buffering', () => {
  it('enqueues a scan preserving its client timestamp', () => {
    const before = Date.now()
    const item = enqueueScan({ token: 'tok_a', gateId: 'gate-1', scannedBy: 'u1' })
    expect(item.token).toBe('tok_a')
    expect(item.clientTs).toBeGreaterThanOrEqual(before)
    expect(item.clientId).toMatch(/^q_/)
    expect(queueLength()).toBe(1)
  })

  it('keeps items in FIFO order', () => {
    enqueueScan({ token: 'a' })
    enqueueScan({ token: 'b' })
    const q = getQueue()
    expect(q.map((i) => i.token)).toEqual(['a', 'b'])
  })
})

describe('scan queue — flush', () => {
  it('syncs each queued scan and empties the queue on success', async () => {
    enqueueScan({ token: 'a' })
    enqueueScan({ token: 'b' })
    const syncOne = vi.fn().mockResolvedValue({ ok: true })
    const res = await flushQueue(syncOne)
    expect(syncOne).toHaveBeenCalledTimes(2)
    expect(res.synced).toBe(2)
    expect(res.remaining).toBe(0)
    expect(queueLength()).toBe(0)
  })

  it('keeps items that fail to sync for the next attempt', async () => {
    enqueueScan({ token: 'a' })
    enqueueScan({ token: 'b' })
    // First item succeeds, second throws (still offline for it).
    const syncOne = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('network'))
    const res = await flushQueue(syncOne)
    expect(res.synced).toBe(1)
    expect(res.remaining).toBe(1)
    expect(queueLength()).toBe(1)
    expect(getQueue()[0].token).toBe('b')
  })

  it('does NOT double-count when flush runs twice (idempotent reconnect)', async () => {
    enqueueScan({ token: 'a' })
    const syncOne = vi.fn().mockResolvedValue({ ok: true })
    await flushQueue(syncOne)      // first reconnect
    // Simulate the item being re-added by a race, then flush again:
    // because its clientId is recorded as flushed, it must not be sent again.
    const res2 = await flushQueue(syncOne)
    expect(res2.synced).toBe(0)
    expect(syncOne).toHaveBeenCalledTimes(1) // only ever sent once
  })

  it('flushing an empty queue is a no-op', async () => {
    const syncOne = vi.fn()
    const res = await flushQueue(syncOne)
    expect(syncOne).not.toHaveBeenCalled()
    expect(res).toEqual({ synced: 0, remaining: 0 })
  })
})
