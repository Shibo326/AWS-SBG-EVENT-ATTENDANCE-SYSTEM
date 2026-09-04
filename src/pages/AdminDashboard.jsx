import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Stat, Card, Badge, Avatar, ProgressBar, Input, Field, Select, EmptyState, Button } from '../components/ui.jsx'
import { getEvent, listAttendees, attendeeStats, eventStats, allScans, getAttendee, attendeeNeedsReview, addCorrection, listCorrections, myReviewRequests, resolveReview } from '../lib/store.js'
import { useStore, useNow } from '../lib/hooks.js'
import { formatDuration, formatTime, formatDateTime } from '../lib/time.js'
import { toast } from '../components/Toast.jsx'
import { Search, X } from '../components/icons.jsx'

export default function AdminDashboard() {
  useStore()
  const now = useNow(1000)
  const { eventId } = useParams()
  const [query, setQuery] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [fixFor, setFixFor] = useState(null)
  const event = getEvent(eventId)

  if (!event) {
    return <AdminLayout><EmptyState icon={Search} title="Event not found" description="This event may have been removed." action={<Button to="/admin">Back to events</Button>} /></AdminLayout>
  }

  const s = eventStats(eventId, now)
  const attendees = listAttendees(eventId)
    .filter((a) => a.status === 'approved')
    .filter((a) => a.full_name.toLowerCase().includes(query.toLowerCase()) || a.email.toLowerCase().includes(query.toLowerCase()))
    .filter((a) => !reviewOnly || attendeeNeedsReview(eventId, a.id, now))

  return (
    <AdminLayout>
      <PageHeader title="Live dashboard" subtitle={`${event.meta.venue} · updates in real time`} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        <Stat label="Currently inside" value={s.inside} tone="teal" live />
        <Stat label="Registered" value={s.registered} />
        <Stat label="Not yet arrived" value={s.notArrived} tone="muted" />
        <Stat label="Certificate eligible" value={s.eligible} tone="amber" />
        <Stat label="Pending approval" value={s.pending} tone="muted" />
        <button onClick={() => setReviewOnly((v) => !v)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface rounded-xl">
          <Stat label={reviewOnly ? 'Needs review ·filtered' : 'Needs review'} value={s.needsReview} tone={s.needsReview > 0 ? 'red' : 'muted'} />
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Attendee list */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-brand-line p-4">
              <h2 className="font-display font-semibold text-brand-ink">Attendees</h2>
              <Input className="h-9 max-w-[200px]" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {attendees.length === 0 ? (
              <div className="p-8 text-center text-sm text-brand-muted">No approved attendees match.</div>
            ) : (
              <ul className="divide-y divide-brand-line">
                {attendees.map((a) => {
                  const st = attendeeStats(eventId, a.id, now)
                  return (
                    <li key={a.id} className="flex items-center gap-3 p-4">
                      <Avatar name={a.full_name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-brand-ink">{a.full_name}</p>
                          {st.isInside ? (
                            <Badge tone="teal"><span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-brand-teal" /> Inside</Badge>
                          ) : st.entryCount > 0 ? (
                            <Badge tone="amber">Outside</Badge>
                          ) : (
                            <Badge tone="gray">Not arrived</Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-brand-muted">{a.email}</p>
                      </div>
                      <div className="hidden w-40 sm:block">
                        <div className="flex items-center justify-between text-xs tabular">
                          <span className="font-medium text-brand-ink">{formatDuration(st.totalMinutes)}</span>
                          <span className="text-brand-muted">{formatDuration(st.requiredMinutes)}</span>
                        </div>
                        <div className="mt-1.5"><ProgressBar pct={st.progressPct} tone={st.isEligible ? 'green' : 'amber'} label={`${a.full_name} progress`} /></div>
                      </div>
                      <div className="flex w-32 items-center justify-end gap-2">
                        {attendeeNeedsReview(eventId, a.id, now) && <Badge tone="red">Review</Badge>}
                        {st.isEligible ? <Badge tone="green">Eligible</Badge> : <span className="tabular text-xs text-brand-muted">{formatDuration(st.remainingMinutes)}</span>}
                        <Button size="sm" variant="ghost" onClick={() => setFixFor(a)} aria-label={`Fix ${a.full_name}`}>Fix</Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Live scan log */}
        <div>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-brand-line p-4">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-pulse-ring" aria-hidden="true" />
              <h2 className="font-display font-semibold text-brand-ink">Live scan log</h2>
            </div>
            <ScanLog eventId={eventId} />
          </Card>
        </div>
      </div>

      {fixFor && <CorrectionModal eventId={eventId} attendee={fixFor} onClose={() => setFixFor(null)} />}
    </AdminLayout>
  )
}

// Corrections tool (Module 5). Append-only fixes with a required reason:
// insert a missing scan, void a wrong scan, or adjust minutes. Also shows the
// attendee's open review requests so an admin can act on a dispute and resolve it.
function CorrectionModal({ eventId, attendee, onClose }) {
  const now = useNow(1000)
  const [type, setType] = useState('insert_missing_scan')
  const [direction, setDirection] = useState('out')
  const [when, setWhen] = useState(() => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [voidId, setVoidId] = useState('')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const scans = allScans(eventId).filter((sc) => sc.attendee_id === attendee.id && sc.outcome === 'accepted')
  const history = listCorrections(eventId, attendee.id)
  const reviews = myReviewRequests(eventId, attendee.id).filter((r) => r.status === 'open')
  const st = attendeeStats(eventId, attendee.id, now)

  const apply = () => {
    if (!reason.trim()) return setErr('A reason is required.')
    let payload = null, target = null
    if (type === 'insert_missing_scan') payload = { direction, timestamp: new Date(when).getTime() }
    else if (type === 'void_scan') { if (!voidId) return setErr('Pick a scan to void.'); target = voidId }
    else if (type === 'adjust_minutes') { const d = Number(delta); if (!d) return setErr('Enter a non-zero minute adjustment.'); payload = { delta_minutes: d } }

    const res = addCorrection(eventId, attendee.id, { type, payload, target_scan_id: target, reason })
    if (res.error) return setErr(res.error)
    // If this resolves an open review, close it too.
    reviews.forEach((r) => resolveReview(eventId, r.id))
    toast(`Correction saved for ${attendee.full_name}`, 'success')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 animate-rise">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-brand-ink">Fix record — {attendee.full_name}</h3>
              <p className="text-sm text-brand-muted">Current total: {formatDuration(st.totalMinutes)} · {st.isInside ? 'inside' : 'outside'}</p>
            </div>
            {st.capped && <Badge tone="amber">Capped session</Badge>}
          </div>

          {reviews.length > 0 && (
            <div className="mt-4 rounded-xl border border-brand-red/30 bg-brand-redSoft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">Attendee requested a review</p>
              {reviews.map((r) => (
                <p key={r.id} className="mt-1 text-sm text-brand-ink">“{r.message || 'No message'}”</p>
              ))}
              <p className="mt-1 text-xs text-brand-muted">Saving a correction below will mark this resolved.</p>
            </div>
          )}

          <div className="mt-4 space-y-4">
            <Field label="What needs fixing?">
              <Select value={type} onChange={(e) => { setType(e.target.value); setErr('') }}>
                <option value="insert_missing_scan">Insert a missing scan</option>
                <option value="void_scan">Void a wrong scan</option>
                <option value="adjust_minutes">Adjust minutes</option>
              </Select>
            </Field>

            {type === 'insert_missing_scan' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Direction">
                  <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
                    <option value="in">IN (entry)</option>
                    <option value="out">OUT (exit)</option>
                  </Select>
                </Field>
                <Field label="When"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
              </div>
            )}

            {type === 'void_scan' && (
              <Field label="Which scan to void?" error={err && !voidId ? err : ''}>
                <Select value={voidId} onChange={(e) => { setVoidId(e.target.value); setErr('') }}>
                  <option value="">Select a scan…</option>
                  {scans.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.direction.toUpperCase()} · {formatDateTime(sc.scanned_at)}</option>
                  ))}
                </Select>
              </Field>
            )}

            {type === 'adjust_minutes' && (
              <Field label="Minutes to add or subtract" hint="Use a negative number to subtract">
                <Input type="number" value={delta} onChange={(e) => { setDelta(e.target.value); setErr('') }} placeholder="e.g. 30 or -15" />
              </Field>
            )}

            <Field label="Reason (required)" error={err && !reason.trim() ? err : ''}>
              <Input value={reason} onChange={(e) => { setReason(e.target.value); setErr('') }} placeholder="e.g. Gate was offline; entered at 9:05" />
            </Field>

            {err && reason.trim() && voidId !== '' && <p className="text-sm text-brand-red">{err}</p>}

            <div className="flex gap-2">
              <Button onClick={apply}>Save correction</Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="mt-6 border-t border-brand-line pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Correction history</h4>
              <ul className="mt-2 space-y-2">
                {history.map((c) => (
                  <li key={c.id} className="rounded-lg bg-brand-surfaceAlt p-2.5 text-xs text-brand-ink">
                    <span className="font-medium">{c.type.replace(/_/g, ' ')}</span> — {c.reason}
                    <span className="block text-brand-muted">{formatDateTime(c.corrected_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function ScanLog({ eventId }) {
  const scans = allScans(eventId).slice(0, 25)
  if (scans.length === 0) return <div className="p-8 text-center text-sm text-brand-muted">No scans yet.</div>
  return (
    <ul className="max-h-[520px] divide-y divide-brand-line overflow-y-auto">
      {scans.map((sc) => {
        const a = getAttendee(eventId, sc.attendee_id)
        const rejected = sc.outcome !== 'accepted'
        return (
          <li key={sc.id} className="flex items-center gap-3 p-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${
              rejected ? 'bg-brand-redSoft text-brand-red' : sc.direction === 'in' ? 'bg-brand-greenSoft text-brand-green' : 'bg-brand-amberSoft text-brand-amberDark'
            }`}>
              {rejected ? <X size={16} /> : sc.direction === 'in' ? 'IN' : 'OUT'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-brand-ink">{a?.full_name || 'Unknown'}</p>
              <p className="text-xs text-brand-muted">{rejected ? sc.outcome.replace('rejected_', 'rejected: ') : `Scanned ${sc.direction}`}</p>
            </div>
            <span className="tabular text-xs text-brand-muted">{formatTime(sc.scanned_at)}</span>
          </li>
        )
      })}
    </ul>
  )
}
