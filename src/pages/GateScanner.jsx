import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listEvents, anyApprovedToken, processScan, listAttendees } from '../lib/store.js'
import { useStore } from '../lib/hooks.js'
import { formatDuration, formatTime } from '../lib/time.js'

// The prototype has no real camera. This screen simulates the scan pipeline
// (Module 4): resolve token -> event, cooldown, derive IN/OUT, big feedback.
// The camera viewport is represented; "Simulate scan" stands in for a decode.

const FEEDBACK = {
  in: { bg: 'bg-brand-green', label: 'CHECKED IN', icon: '↓', sound: 'rising tone' },
  out: { bg: 'bg-brand-amberDark', label: 'CHECKED OUT', icon: '↑', sound: 'falling tone' },
  rejected: { bg: 'bg-brand-red', label: 'REJECTED', icon: '✕', sound: 'error buzz' },
}

export default function GateScanner() {
  useStore()
  const events = listEvents().filter((e) => e.status === 'active')
  const [gateEvent, setGateEvent] = useState(events[0]?.id || '')
  const [result, setResult] = useState(null)
  const [flash, setFlash] = useState(null)
  const [lookupOpen, setLookupOpen] = useState(false)
  const [lookupQuery, setLookupQuery] = useState('')

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2000)
    return () => clearTimeout(t)
  }, [flash])

  const doScan = (token) => {
    const r = processScan(token)
    setResult(r)
    const kind = r.outcome === 'accepted' ? r.direction : 'rejected'
    setFlash({ kind, r })
  }

  const simulate = () => {
    const token = anyApprovedToken(gateEvent) || 'invalid-token'
    doScan(token)
  }
  const simulateInvalid = () => doScan('totally-invalid-qr')

  const lookupList = listAttendees(gateEvent)
    .filter((a) => a.status === 'approved' && a.qr_token)
    .filter((a) => a.full_name.toLowerCase().includes(lookupQuery.toLowerCase()))

  const recordManual = (attendee) => {
    doScan(attendee.qr_token) // same pipeline, resolved from the person's own token
    setLookupOpen(false)
    setLookupQuery('')
  }

  const fb = flash ? (FEEDBACK[flash.kind] || FEEDBACK.rejected) : null

  return (
    <div className="min-h-screen bg-brand-ink text-white">
      {/* Full-screen colour flash — the signature glanceable moment.
          Colour + icon + huge name read from arm's length, outdoors. Sound
          label documents the distinct tone paired with each outcome. */}
      {flash && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${fb.bg} p-6 text-center animate-rise`}
          role="status"
          aria-live="assertive"
        >
          <div className="text-8xl font-black leading-none" aria-hidden="true">{fb.icon}</div>
          <div className="mt-3 font-display text-4xl font-bold uppercase tracking-widest">{fb.label}</div>
          {flash.r.attendee && (
            <div className="mt-6 font-display text-5xl font-bold leading-tight">{flash.r.attendee.full_name}</div>
          )}
          {flash.r.outcome === 'accepted' ? (
            <div className="mt-5 text-xl text-white/95">
              <span className="tabular">Total inside: {formatDuration(flash.r.stats.totalMinutes)}</span>
              <span className="mx-2 text-white/50">·</span>
              <span className="tabular">{formatTime(flash.r.at)}</span>
              {flash.r.stats.isEligible && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/25 px-5 py-1.5 text-lg font-semibold">
                  ✓ Certificate eligible
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 max-w-sm text-xl text-white/95">{flash.r.message}</div>
          )}
        </div>
      )}

      {/* Manual lookup — fallback when a QR can't be read (dead phone, glare, cracked screen) */}
      {lookupOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-brand-ink/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="font-display text-lg font-bold">Manual lookup</h2>
            <button onClick={() => { setLookupOpen(false); setLookupQuery('') }} className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/10">Close</button>
          </div>
          <div className="p-4">
            <input
              autoFocus
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Type the attendee's name…"
              className="h-12 w-full rounded-xl border border-white/20 bg-brand-navy px-4 text-white placeholder:text-white/40 focus:border-brand-amber focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
            />
            <p className="mt-2 text-xs text-white/50">Use this when a QR won&rsquo;t scan. Tap a name to record their IN/OUT — logged as a manual entry.</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {lookupList.length === 0 ? (
              <p className="mt-8 text-center text-sm text-white/50">No approved attendee matches.</p>
            ) : (
              <ul className="space-y-2">
                {lookupList.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => recordManual(a)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-brand-navy p-3 text-left transition-colors hover:border-brand-amber/50 hover:bg-white/5"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-amber/20 font-semibold text-brand-amber">
                        {a.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.full_name}</span>
                        <span className="block truncate text-xs text-white/50">{a.email}</span>
                      </span>
                      <span className="text-white/40">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <Link to="/admin" className="flex items-center gap-2.5 font-display font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-amber text-brand-ink">A</span>
          Gate Scanner
        </Link>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-pulse-ring" aria-hidden="true" />
          Gate 1
        </span>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        <label htmlFor="gate-event" className="mb-2 block text-sm text-white/70">Scanning for event</label>
        <select
          id="gate-event"
          value={gateEvent}
          onChange={(e) => setGateEvent(e.target.value)}
          className="mb-5 h-11 w-full rounded-xl border border-white/20 bg-brand-navy px-3 text-white focus:border-brand-amber focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
        >
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        {/* Camera viewport with animated corner guides */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/15 bg-black/50 shadow-e3">
          <div className="absolute inset-10 rounded-xl">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-brand-amber" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-brand-amber" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-brand-amber" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-brand-amber" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-center text-white/50">
            <div>
              <div className="text-5xl" aria-hidden="true">📷</div>
              <p className="mt-2 text-sm">Point the camera at an attendee&rsquo;s QR</p>
              <p className="mt-1 text-xs text-white/30">(prototype — use the buttons below)</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <button onClick={simulate}
            className="h-16 w-full rounded-xl bg-brand-amber font-display text-lg font-bold text-brand-ink shadow-e2 transition-[background-color,transform] duration-150 hover:bg-brand-amberDark active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink">
            Simulate a scan
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={simulateInvalid}
              className="h-11 rounded-xl border border-white/20 text-sm text-white/80 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              Invalid QR
            </button>
            <button
              onClick={() => setLookupOpen(true)}
              className="h-11 rounded-xl border border-white/20 text-sm text-white/80 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
              🔎 Manual lookup
            </button>
          </div>
        </div>

        {/* Last result (persists after flash) */}
        {result && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-brand-navy p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">Last scan</p>
            {result.outcome === 'accepted' ? (
              <div className="mt-1.5">
                <p className="font-display text-lg font-bold">{result.attendee.full_name}</p>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${result.direction === 'in' ? 'bg-brand-green' : 'bg-brand-amberDark'}`}>
                    {result.direction === 'in' ? 'IN' : 'OUT'}
                  </span>
                  <span className="tabular text-white/70">{formatDuration(result.stats.totalMinutes)} total · {formatTime(result.at)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-white/80">{result.message}</p>
            )}
          </div>
        )}

        {/* Legend — colour + sound key, so a briefed volunteer can rely on either channel */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-green" />Entry</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-amberDark" />Exit</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-red" />Rejected</span>
        </div>
        <p className="mt-2 text-center text-xs text-white/30">Each outcome also plays a distinct sound in production.</p>
      </div>
    </div>
  )
}
