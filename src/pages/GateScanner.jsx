import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import jsQRModule from 'jsqr'
// jsqr ships CJS — the default export may be nested under .default in some bundlers
const jsQR = typeof jsQRModule === 'function' ? jsQRModule : jsQRModule?.default
import { listEvents, anyApprovedToken, processScan, listAttendees } from '../lib/store.js'
import { useStore } from '../lib/hooks.js'
import { formatDuration, formatTime } from '../lib/time.js'
import { ArrowDown, ArrowUp, X, Check, Camera, CameraOff, Dice, Search, ArrowRight } from '../components/icons.jsx'

// Module 4 gate scanner — jsQR + raw getUserMedia for full stream control.
// Key improvements over html5-qrcode:
//   • continuousAutoFocus applied directly on the MediaStreamTrack
//   • High resolution (1280×720) so the QR modules are large enough to decode
//   • requestAnimationFrame scan loop — no fps cap, no dropped frames
//   • focusTap: clicking the viewport triggers a one-shot pointOfInterest refocus

const FEEDBACK = {
  in:       { bg: 'bg-brand-green',     label: 'CHECKED IN',  Icon: ArrowDown },
  out:      { bg: 'bg-brand-amberDark', label: 'CHECKED OUT', Icon: ArrowUp },
  rejected: { bg: 'bg-brand-red',       label: 'REJECTED',    Icon: X },
}

export default function GateScanner() {
  useStore()
  const [searchParams, setSearchParams] = useSearchParams()

  // Active events only — the only ones a gate scanner should operate on
  const events = listEvents().filter((e) => e.status === 'active')

  // Prefer ?event=<id> from the URL so bookmarked scanner links auto-select
  // the right event without the volunteer having to pick from the dropdown.
  const urlEventId = searchParams.get('event')
  const defaultEventId = (urlEventId && events.some((e) => e.id === urlEventId))
    ? urlEventId
    : events[0]?.id || ''
  const [gateEvent, setGateEvent] = useState(defaultEventId)

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
  const [scanning, setScanning] = useState(false) // true while RAF loop is live
  const [debugInfo, setDebugInfo] = useState('')
  const frameCountRef = useRef(0)

  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)   // MediaStream
  const rafRef      = useRef(null)   // requestAnimationFrame handle
  const cooldownRef = useRef(false)  // brief per-decode pause so flash renders

  // ── flash auto-reset ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!flash) return
    // Resume scan loop after flash clears (2 s)
    const t = setTimeout(() => {
      setFlash(null)
      cooldownRef.current = false
    }, 2000)
    return () => clearTimeout(t)
  }, [flash])

  // ── scan result handler ──────────────────────────────────────────────────────
  const doScan = useCallback((token) => {
    if (cooldownRef.current) return   // flash is showing, swallow extra decodes
    cooldownRef.current = true
    console.log('[scanner] decoded token:', token) // debug — remove after confirming
    const r = processScan(token)
    setResult(r)
    const kind = r.outcome === 'accepted' ? r.direction : 'rejected'
    setFlash({ kind, r })
  }, [])

  // ── RAF decode loop ──────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    frameCountRef.current = 0

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && !cooldownRef.current) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        canvas.width  = vw
        canvas.height = vh

        ctx.drawImage(video, 0, 0, vw, vh)
        const img = ctx.getImageData(0, 0, vw, vh)

        // Manual grayscale + contrast stretch — ctx.filter doesn't affect
        // getImageData pixel data in most browsers, so we do it in-buffer.
        const d = img.data
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          const v = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30)
          d[i] = d[i + 1] = d[i + 2] = v
        }

        const code = jsQR(d, vw, vh, { inversionAttempts: 'attemptBoth' })
        frameCountRef.current++

        // Update debug info every 30 frames (~0.5s)
        if (frameCountRef.current % 30 === 0) {
          setDebugInfo(`${vw}x${vh} · frame ${frameCountRef.current}${code ? ' · decoded' : ''}`)
        }

        if (code) doScan(code.data)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    setScanning(true)
  }, [doScan])

  // ── apply continuous autofocus on the track ──────────────────────────────────
  const applyAutofocus = useCallback(async (stream) => {
    const [track] = stream.getVideoTracks()
    if (!track) return
    const caps = track.getCapabilities?.() || {}
    const constraints = {}
    if (caps.focusMode?.includes?.('continuous')) {
      constraints.focusMode = 'continuous'
    }
    // Prefer a moderate zoom-in (1.5×) so the QR fills more pixels
    if (caps.zoom) {
      const zoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.5))
      constraints.zoom = zoom
    }
    if (Object.keys(constraints).length) {
      try { await track.applyConstraints({ advanced: [constraints] }) } catch (_) {}
    }
  }, [])

  // ── camera start ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null)
    // Stop any lingering stream first — previous tab/reload may not have cleaned up
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      await video.play()
      await applyAutofocus(stream)
      setCameraActive(true)
      startLoop()
    } catch (err) {
      const msg =
        err?.name === 'NotAllowedError'  ? 'Camera permission denied. Allow it in browser settings then retry.' :
        err?.name === 'NotFoundError'    ? 'No camera found on this device.' :
        err?.name === 'NotReadableError' ? 'Camera is in use by another app. Close it and retry.' :
        (err?.message || 'Could not access camera.')
      setCameraError(msg)
    }
  }, [applyAutofocus, startLoop])

  // ── camera stop ──────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    setScanning(false)
  }, [])

  // Stop on unmount
  useEffect(() => () => stopCamera(), [stopCamera])

  // ── tap-to-focus ─────────────────────────────────────────────────────────────
  const handleViewportTap = useCallback(async (e) => {
    if (!streamRef.current) return
    const [track] = streamRef.current.getVideoTracks()
    if (!track) return
    const caps = track.getCapabilities?.() || {}
    // Try pointOfInterest focus (Chrome Android / some webcams)
    if (caps.focusMode?.includes?.('single-shot') && caps.pointOfInterest) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top)  / rect.height
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointOfInterest: { x, y } }] })
        // Switch back to continuous after the one-shot settles
        setTimeout(async () => {
          try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }) } catch (_) {}
        }, 1000)
      } catch (_) {}
    }
  }, [])

  // ── simulate helpers ──────────────────────────────────────────────────────────
  const simulate        = () => doScan(anyApprovedToken(gateEvent) || 'invalid-token')
  const simulateInvalid = () => doScan('totally-invalid-qr')

  // Manual lookup — only filter & render when user has typed something.
  // Cap at 20 results so the list stays snappy even for large events.
  const LOOKUP_MIN_CHARS = 2
  const allApprovedAttendees = listAttendees(gateEvent).filter(
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
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${scanning ? 'bg-brand-teal animate-pulse-ring' : 'bg-white/30'}`} aria-hidden="true" />
          {scanning ? 'Scanning' : 'Idle'}
        </span>
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

        {/* Camera viewport */}
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-black shadow-e3 cursor-crosshair"
          onClick={handleViewportTap}
          title="Tap to focus"
        >
          {/* Hidden canvas used for jsQR frame grabs — never visible */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          {/* Live video */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full"
            style={{ minHeight: 320, display: cameraActive ? 'block' : 'none' }}
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

          {/* Amber corner guides + tap-to-focus hint */}
          {cameraActive && (
            <>
              <div className="pointer-events-none absolute inset-10 rounded-xl">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-brand-amber" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-brand-amber" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-brand-amber" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-brand-amber" />
              </div>
          <p className="pointer-events-none absolute bottom-2 w-full text-center text-[10px] text-white/40">
                Tap viewport to focus
              </p>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="mt-5 space-y-2.5">
          {/* Debug info — shows video resolution + frame count to confirm loop is running */}
          {scanning && debugInfo && (
            <p className="text-center font-mono text-[10px] text-white/30">{debugInfo}</p>
          )}
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
