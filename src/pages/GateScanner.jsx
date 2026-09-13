import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { processScan, syncOfflineScan, anyApprovedTokenFrom, listAttendeesFrom } from '../lib/db.js'
import { enqueueScan, flushQueue, queueLength, isOnline } from '../lib/scanQueue.js'
import { useEvents } from '../lib/dbHooks.js'
import { useAuth } from '../lib/auth.jsx'
import { formatDuration, formatTime } from '../lib/time.js'
import { ArrowDown, ArrowUp, X, Check, Camera, CameraOff, Dice, Search, ArrowRight } from '../components/icons.jsx'

// Module 4 gate scanner — camera decode via html5-qrcode (PROJECT_PLAN §5.1).
// The library owns the camera stream + decode loop and renders into a div; we
// keep the whole scan flow around it (5s cooldown, IN/OUT via processScan,
// full-screen colour flash, manual-name-lookup fallback, per-event selection).

const SCANNER_ELEMENT_ID = 'gate-qr-reader'

const FEEDBACK = {
  in:       { bg: 'bg-brand-green',     label: 'CHECKED IN',  Icon: ArrowDown },
  out:      { bg: 'bg-brand-amberDark', label: 'CHECKED OUT', Icon: ArrowUp },
  rejected: { bg: 'bg-brand-red',       label: 'REJECTED',    Icon: X },
  queued:   { bg: 'bg-brand-navy',      label: 'SAVED OFFLINE', Icon: Check },
}

export default function GateScanner() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { events: allEvents } = useEvents()
  const { user } = useAuth()

  // Active events only — the only ones a gate scanner should operate on.
  // events are full snapshots {id, meta, settings, attendees, ...}.
  const events = allEvents
    .filter((e) => e.meta?.status === 'active')
    .map((e) => ({ id: e.id, name: e.meta?.name || e.id, snapshot: e }))

  // Prefer ?event=<id> from the URL so bookmarked scanner links auto-select
  // the right event without the volunteer having to pick from the dropdown.
  const urlEventId = searchParams.get('event')
  const defaultEventId = (urlEventId && events.some((e) => e.id === urlEventId))
    ? urlEventId
    : events[0]?.id || ''
  const [gateEvent, setGateEvent] = useState(defaultEventId)

  // Once events load, adopt the default selection if nothing is chosen yet.
  useEffect(() => {
    if (!gateEvent && defaultEventId) setGateEvent(defaultEventId)
  }, [defaultEventId, gateEvent])

  // The live snapshot of the currently selected gate event (for simulate +
  // manual lookup, which need the attendee roster).
  const gateSnapshot = events.find((e) => e.id === gateEvent)?.snapshot || null

  // Keep URL in sync when the dropdown changes
  const handleEventChange = (e) => {
    const id = e.target.value
    setGateEvent(id)
    setSearchParams({ event: id }, { replace: true })
  }

  const [result, setResult]       = useState(null)
  const [flash, setFlash]         = useState(null)
  const [lookupOpen, setLookupOpen]   = useState(false)
  const [lookupQuery, setLookupQuery] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError,  setCameraError]  = useState(null)
  const [scanning, setScanning] = useState(false) // true while the decoder is live
  const [online, setOnline] = useState(isOnline())
  const [pending, setPending] = useState(queueLength()) // buffered offline scans

  const scannerRef  = useRef(null)   // Html5Qrcode instance
  const cooldownRef = useRef(false)  // brief per-decode pause so flash renders

  // ── offline queue: flush on reconnect + periodically (R3 / criterion 13) ─────
  const flush = useCallback(async () => {
    if (!isOnline()) return
    const { remaining } = await flushQueue(syncOfflineScan)
    setPending(remaining)
  }, [])

  useEffect(() => {
    const goOnline = () => { setOnline(true); flush() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Also poll: the browser's online event can miss a captive-portal recovery.
    const id = setInterval(() => { setOnline(isOnline()); flush() }, 15000)
    flush() // attempt a flush on mount in case scans were left buffered
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(id)
    }
  }, [flush])

  // ── flash auto-reset ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!flash) return
    // Resume decoding after flash clears (2 s)
    const t = setTimeout(() => {
      setFlash(null)
      cooldownRef.current = false
    }, 2000)
    return () => clearTimeout(t)
  }, [flash])

  // ── scan result handler ──────────────────────────────────────────────────────
  const doScan = useCallback(async (token) => {
    if (cooldownRef.current) return   // flash is showing, swallow extra decodes
    cooldownRef.current = true
    const scannedBy = user?.uid || 'staff'

    // Offline: buffer the scan and confirm immediately — the gate keeps moving.
    // It syncs (preserving its timestamp) on reconnect (R3 / criterion 13).
    if (!isOnline()) {
      enqueueScan({ token, gateId: 'gate-1', scannedBy })
      setPending(queueLength())
      const r = { outcome: 'queued', message: 'No connection — saved and will sync when back online.' }
      setResult(r)
      setFlash({ kind: 'queued', r })
      return
    }

    try {
      const r = await processScan(token, { gateId: 'gate-1', scannedBy })
      setResult(r)
      const kind = r.outcome === 'accepted' ? r.direction : 'rejected'
      setFlash({ kind, r })
    } catch (_) {
      // Network dropped mid-write — buffer it rather than lose it.
      enqueueScan({ token, gateId: 'gate-1', scannedBy })
      setPending(queueLength())
      const r = { outcome: 'queued', message: 'Connection dropped — saved and will sync when back online.' }
      setResult(r)
      setFlash({ kind: 'queued', r })
    }
  }, [user?.uid])

  // ── camera start (html5-qrcode owns the stream + decode loop) ────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null)
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch (_) {}
      try { scannerRef.current.clear() } catch (_) {}
      scannerRef.current = null
    }
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },   // prefer the rear camera at a gate
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decodedText) => { doScan(decodedText) },   // success — a QR was decoded
        () => {},                                    // per-frame "not found" — ignore
      )
      setCameraActive(true)
      setScanning(true)
    } catch (err) {
      const name = err?.name || ''
      const msg =
        name === 'NotAllowedError'  ? 'Camera permission denied. Allow it in browser settings then retry.' :
        name === 'NotFoundError'    ? 'No camera found on this device.' :
        name === 'NotReadableError' ? 'Camera is in use by another app. Close it and retry.' :
        (err?.message || String(err) || 'Could not access camera.')
      setCameraError(msg)
      scannerRef.current = null
    }
  }, [doScan])

  // ── camera stop ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try { await scanner.stop() } catch (_) {}
      try { scanner.clear() } catch (_) {}
    }
    setCameraActive(false)
    setScanning(false)
  }, [])

  // Stop on unmount
  useEffect(() => () => { stopCamera() }, [stopCamera])

  // ── simulate helpers ──────────────────────────────────────────────────────────
  const simulate        = () => doScan(anyApprovedTokenFrom(gateSnapshot) || 'invalid-token')
  const simulateInvalid = () => doScan('totally-invalid-qr')

  // Manual lookup — only filter & render when user has typed something.
  // Cap at 20 results so the list stays snappy even for large events.
  const LOOKUP_MIN_CHARS = 2
  const allApprovedAttendees = listAttendeesFrom(gateSnapshot).filter(
    (a) => a.status === 'approved' && a.qr_token,
  )
  const lookupList = lookupQuery.trim().length >= LOOKUP_MIN_CHARS
    ? allApprovedAttendees
        .filter((a) => a.full_name.toLowerCase().includes(lookupQuery.toLowerCase()))
        .slice(0, 20)
    : []

  const recordManual = (attendee) => {
    doScan(attendee.qr_token)
    setLookupOpen(false)
    setLookupQuery('')
  }

  const fb = flash ? (FEEDBACK[flash.kind] || FEEDBACK.rejected) : null

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-brand-ink text-white">

      {/* Full-screen colour flash */}
      {flash && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${fb.bg} p-6 text-center animate-rise`}
          role="status"
          aria-live="assertive"
        >
          <fb.Icon size={104} strokeWidth={2.5} />
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
                  <Check size={20} /> Certificate eligible
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 max-w-sm text-xl text-white/95">{flash.r.message}</div>
          )}
          <p className="mt-6 text-sm text-white/50">Auto-closing…</p>
        </div>
      )}

      {/* Manual lookup drawer */}
      {lookupOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-brand-ink/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="font-display text-lg font-bold">Manual lookup</h2>
            <button
              onClick={() => { setLookupOpen(false); setLookupQuery('') }}
              className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="p-4">
            <input
              autoFocus
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Type the attendee's name…"
              className="h-12 w-full rounded-xl border border-white/20 bg-brand-navy px-4 text-white placeholder:text-white/40 focus:border-brand-amber focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
            />
            <p className="mt-2 text-xs text-white/50">
              Use when a QR won&rsquo;t scan. Tap a name to record IN/OUT — logged as a manual entry.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {lookupList.length === 0 ? (
              <p className="mt-8 text-center text-sm text-white/50">
                {lookupQuery.trim().length < LOOKUP_MIN_CHARS
                  ? 'Type at least 2 characters to search.'
                  : 'No approved attendee matches.'}
              </p>
            ) : (
              <>
                {lookupList.length === 20 && (
                  <p className="mb-3 text-center text-xs text-white/40">Showing top 20 — type more to narrow down.</p>
                )}
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
                        <ArrowRight size={16} className="text-white/40" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <Link to="/admin" className="flex items-center gap-2.5 font-display font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-amber text-brand-ink">A</span>
          Gate Scanner
        </Link>
        <div className="flex items-center gap-2">
          {/* Online / offline + pending-sync indicator (R3 / criterion 13) */}
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${online ? 'bg-white/10' : 'bg-brand-red/30'}`}
            title={online ? 'Online' : 'Offline — scans are being saved and will sync when the connection returns'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-brand-teal' : 'bg-brand-red animate-pulse-ring'}`} aria-hidden="true" />
            {online ? 'Online' : 'Offline'}
            {pending > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 tabular">{pending} to sync</span>}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${scanning ? 'bg-brand-teal animate-pulse-ring' : 'bg-white/30'}`} aria-hidden="true" />
            {scanning ? 'Scanning' : 'Idle'}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        {/* Event selector */}
        <label htmlFor="gate-event" className="mb-2 block text-sm text-white/70">Scanning for event</label>
        <select
          id="gate-event"
          value={gateEvent}
          onChange={handleEventChange}
          className="mb-1 h-11 w-full rounded-xl border border-white/20 bg-brand-navy px-3 text-white focus:border-brand-amber focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
        >
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {urlEventId && events.some((e) => e.id === urlEventId) && (
          <p className="mb-4 text-xs text-white/40">Event pre-selected via link.</p>
        )}
        {!urlEventId && (
          <p className="mb-4 text-xs text-white/40">
            Tip: bookmark <span className="font-mono">/scan?event={gateEvent}</span> to skip this step.
          </p>
        )}

        {/* Camera viewport — html5-qrcode injects its <video> into this div */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-black shadow-e3">
          <div
            id={SCANNER_ELEMENT_ID}
            className="w-full [&_video]:w-full [&_video]:rounded-2xl"
            style={{ minHeight: cameraActive ? 320 : 0 }}
          />

          {/* Overlay when camera is off */}
          {!cameraActive && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              {cameraError ? (
                <>
                  <CameraOff size={40} className="text-red-400" />
                  <p className="max-w-xs px-4 text-sm text-red-400">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-1 rounded-lg bg-brand-amber px-4 py-2 text-sm font-bold text-brand-ink"
                  >
                    Retry
                  </button>
                </>
              ) : (
                <>
                  <Camera size={44} className="text-white/50" />
                  <p className="text-sm text-white/60">Tap to start camera</p>
                  <button
                    onClick={startCamera}
                    className="mt-1 rounded-xl bg-brand-amber px-6 py-2.5 font-bold text-brand-ink shadow-e2 transition hover:bg-brand-amberDark"
                  >
                    Start camera
                  </button>
                </>
              )}
            </div>
          )}

          {/* Amber corner guides — align the QR inside them */}
          {cameraActive && (
            <div className="pointer-events-none absolute inset-10 rounded-xl">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-brand-amber" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-brand-amber" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-brand-amber" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-brand-amber" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-5 space-y-2.5">
          {cameraActive && (
            <button
              onClick={stopCamera}
              className="h-12 w-full rounded-xl border border-white/20 text-sm text-white/80 transition-colors hover:bg-white/5"
            >
              Stop camera
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={simulate}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 text-sm text-white/80 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Dice size={16} />Simulate scan
            </button>
            <button
              onClick={() => setLookupOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 text-sm text-white/80 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Search size={16} />Manual lookup
            </button>
          </div>
        </div>

        {/* Last result */}
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
                  <span className="tabular text-white/70">
                    {formatDuration(result.stats.totalMinutes)} total · {formatTime(result.at)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-1.5">
                <p className="text-sm text-white/80">{result.message}</p>
                {result.decodedToken && (
                  <p className="mt-1 break-all font-mono text-[10px] text-white/40">decoded: {result.decodedToken}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
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
