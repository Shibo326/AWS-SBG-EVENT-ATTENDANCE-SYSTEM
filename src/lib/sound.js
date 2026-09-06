// Scan feedback sounds via the Web Audio API — no audio files.
// Three distinct cues so a gate volunteer can rely on sound alone in a queue:
//   • IN       → two rising notes (confirming, "welcome")
//   • OUT      → two falling notes (departing)
//   • rejected → low buzz (something's wrong)
//
// The AudioContext is created lazily on first use because browsers block audio
// until a user gesture — by the time a scan fires, the user has already tapped
// "Start camera", so playback is allowed.

let ctx = null
let muted = false

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  // Resume if the browser auto-suspended it (common on mobile).
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** Play a single tone. */
function tone(freq, startAt, duration, { type = 'sine', gain = 0.18 } = {}) {
  const ac = getCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  // Short attack/decay so it clicks cleanly, no pop.
  g.gain.setValueAtTime(0.0001, startAt)
  g.gain.exponentialRampToValueAtTime(gain, startAt + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.connect(g).connect(ac.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

export function setMuted(v) { muted = v }
export function isMuted() { return muted }

export function playIn() {
  if (muted) return
  const ac = getCtx(); if (!ac) return
  const t = ac.currentTime
  tone(660, t, 0.12)          // E5
  tone(880, t + 0.1, 0.16)    // A5 — rising
}

export function playOut() {
  if (muted) return
  const ac = getCtx(); if (!ac) return
  const t = ac.currentTime
  tone(660, t, 0.12)          // E5
  tone(440, t + 0.1, 0.16)    // A4 — falling
}

export function playRejected() {
  if (muted) return
  const ac = getCtx(); if (!ac) return
  const t = ac.currentTime
  tone(180, t, 0.28, { type: 'square', gain: 0.14 }) // low buzz
}

/** Convenience: play the right cue for a scan outcome. */
export function playForScan(result) {
  if (result?.outcome === 'accepted') {
    result.direction === 'in' ? playIn() : playOut()
  } else {
    playRejected()
  }
}
