// Offline scan queue (PROJECT_PLAN §7 Module 4, R3, acceptance criterion 13).
//
// Venue Wi-Fi is unreliable; a gate that stops working when the network hiccups
// stops the event. So when the network is down (or a scan write fails), the
// scan is buffered in localStorage and flushed automatically on reconnect,
// PRESERVING ITS ORIGINAL TIMESTAMP, without double-counting.
//
// Timestamp problem & resolution:
//   Normal scans use a SERVER timestamp (§9.3, rules force scanned_at === now),
//   which is correct for a live scan but WRONG for one that physically happened
//   minutes ago while offline. The plan's own mechanism for "attendee entered
//   while the gate device was offline" is the corrections tool's
//   `insert_missing_scan` (Module 5), whose payload carries a client timestamp
//   and which the time engine already applies. So a flushed offline scan is
//   written as an insert_missing_scan correction with its captured client time,
//   satisfying both the server-timestamp rule AND timestamp preservation.
//
// De-duplication: each queued item has a unique clientId. On flush we record
// flushed clientIds; a re-flush (e.g. two reconnect triggers racing) skips any
// already-sent item, so a reconnect cannot double-count (§14 Resilience).

const QUEUE_KEY = 'sbg_scan_queue_v1'
const FLUSHED_KEY = 'sbg_scan_flushed_v1'

const read = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
const write = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* quota / private mode — best effort */ }
}

const newClientId = () => {
  const a = new Uint8Array(8)
  ;(globalThis.crypto || {}).getRandomValues?.(a)
  return 'q_' + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('') + Date.now().toString(36)
}

/** Current pending queue (array of items). */
export function getQueue() {
  return read(QUEUE_KEY, [])
}

/** How many scans are waiting to sync. */
export function queueLength() {
  return getQueue().length
}

/**
 * Buffer a scan for later sync. Captures the token, the gate, the operator, and
 * the CLIENT timestamp (when the scan physically happened). Returns the item.
 */
export function enqueueScan({ token, gateId, scannedBy }) {
  const item = {
    clientId: newClientId(),
    token,
    gateId: gateId || 'gate-1',
    scannedBy: scannedBy || 'staff',
    clientTs: Date.now(),
  }
  const q = getQueue()
  q.push(item)
  write(QUEUE_KEY, q)
  return item
}

function markFlushed(clientId) {
  const f = read(FLUSHED_KEY, [])
  if (!f.includes(clientId)) { f.push(clientId); write(FLUSHED_KEY, f.slice(-500)) } // cap history
}
function alreadyFlushed(clientId) {
  return read(FLUSHED_KEY, []).includes(clientId)
}

/**
 * Flush the queue. `syncOne(item)` must persist one buffered scan (returning a
 * promise) — it is injected so this module has no direct Firebase dependency
 * (keeps it unit-testable). Items that succeed are removed and recorded as
 * flushed; items that fail stay queued for the next attempt. Idempotent: an
 * item already recorded as flushed is dropped without re-sending.
 *
 * @returns {Promise<{ synced:number, remaining:number }>}
 */
export async function flushQueue(syncOne) {
  let q = getQueue()
  if (q.length === 0) return { synced: 0, remaining: 0 }
  let synced = 0
  const stillPending = []
  for (const item of q) {
    if (alreadyFlushed(item.clientId)) { synced++; continue } // dedup guard
    try {
      await syncOne(item)
      markFlushed(item.clientId)
      synced++
    } catch {
      stillPending.push(item)   // keep for next reconnect
    }
  }
  write(QUEUE_KEY, stillPending)
  return { synced, remaining: stillPending.length }
}

/** True if the browser currently reports being online. */
export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}
