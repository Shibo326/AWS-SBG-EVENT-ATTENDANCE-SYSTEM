import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Button, Badge, QRCode, ProgressBar, StatusBadge, Field, Input } from '../components/ui.jsx'
import { findByClaim, getEvent, attendeeStats, acceptedScansFor, requestReview, myReviewRequests } from '../lib/store.js'
import { useStore, useNow } from '../lib/hooks.js'
import { formatDuration, formatDateTime, formatTime } from '../lib/time.js'
import { toast } from '../components/Toast.jsx'
import { Search, Clock, X, Check } from '../components/icons.jsx'

export default function StudentSelfService() {
  useStore()
  const now = useNow(1000)
  const { claimToken } = useParams()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')
  const found = findByClaim(claimToken)

  if (!found) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-surfaceAlt text-brand-muted"><Search size={26} /></div>
          <h1 className="mt-3 font-display text-xl font-bold text-brand-ink">Page not found</h1>
          <p className="mt-1 text-sm text-brand-muted">This link is invalid. Check the link from your confirmation.</p>
        </Card>
      </Shell>
    )
  }

  const { eventId, attendee } = found
  const event = getEvent(eventId)
  const meta = event.meta
  const st = attendeeStats(eventId, attendee.id, now)
  const scans = acceptedScansFor(eventId, attendee.id).sort((a, b) => b.scanned_at - a.scanned_at)

  return (
    <Shell>
      {/* Event + identity */}
      <Card className="overflow-hidden">
        <div className="bg-brand-navy p-5 text-white">
          <p className="text-sm text-white/70">{meta.name}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">{attendee.full_name}</h1>
          <div className="mt-2.5"><StatusBadge status={attendee.status} /></div>
        </div>
      </Card>

      {/* Pending / rejected states */}
      {attendee.status === 'pending' && (
        <Card className="mt-4 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-amberSoft text-brand-amberDark"><Clock size={24} /></div>
          <h2 className="mt-2 font-display font-semibold text-brand-ink">Waiting for approval</h2>
          <p className="mt-1 text-sm text-brand-muted">Your QR ticket appears here once an admin approves your registration.</p>
        </Card>
      )}
      {attendee.status === 'rejected' && (
        <Card className="mt-4 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-redSoft text-brand-red"><X size={24} /></div>
          <h2 className="mt-2 font-display font-semibold text-brand-ink">Registration not approved</h2>
          <p className="mt-1 text-sm text-brand-muted">Please contact the event organizer.</p>
        </Card>
      )}

      {attendee.status === 'approved' && (
        <>
          {/* Scan-out reminder — teal "live" treatment, the most common cause of a wrong total */}
          {st.isInside && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-teal/30 bg-brand-tealSoft p-4 text-sm text-brand-teal">
              <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-teal animate-pulse-ring" aria-hidden="true" />
              <span className="leading-relaxed">You&rsquo;re currently <strong>inside</strong>. Remember to scan <strong>OUT</strong> when you leave, or your time won&rsquo;t be counted correctly.</span>
            </div>
          )}

          {/* QR ticket */}
          <Card className="mt-4 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Your entry ticket</p>
            <div className="mt-4 flex justify-center">
              <QRCode value={attendee.qr_token} size={220} />
            </div>
            <p className="mt-4 text-sm text-brand-muted">Show this at the gate to scan in and out.</p>
          </Card>

          {/* Progress */}
          <Card className="mt-4 p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Time inside</p>
                <p className="mt-1 font-display text-3xl font-bold tabular text-brand-ink">{formatDuration(st.totalMinutes)}</p>
              </div>
              {st.isEligible ? <Badge tone="green"><Check size={13} />Eligible</Badge> : <span className="pb-1 text-sm text-brand-muted">of {formatDuration(st.requiredMinutes)}</span>}
            </div>
            <div className="mt-3"><ProgressBar pct={st.progressPct} tone={st.isEligible ? 'green' : 'amber'} label="Progress toward certificate" /></div>
            {!st.isEligible && (
              <p className="mt-2.5 text-sm text-brand-slate">
                <strong className="text-brand-ink">{formatDuration(st.remainingMinutes)}</strong> more to earn your certificate.
              </p>
            )}
            {st.isEligible && (
              <p className="mt-2.5 text-sm font-medium text-brand-green">You&rsquo;ve met the requirement. Your certificate will be sent after the event.</p>
            )}
          </Card>

          {/* History */}
          <Card className="mt-4 overflow-hidden">
            <div className="border-b border-brand-line p-4">
              <h2 className="font-display font-semibold text-brand-ink">My scans</h2>
            </div>
            {scans.length === 0 ? (
              <p className="p-6 text-center text-sm text-brand-muted">No scans yet. Scan in at the gate to start your timer.</p>
            ) : (
              <ul className="divide-y divide-brand-line">
                {scans.map((sc) => (
                  <li key={sc.id} className="flex items-center gap-3 p-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sc.direction === 'in' ? 'bg-brand-greenSoft text-brand-green' : 'bg-brand-amberSoft text-brand-amberDark'}`}>
                      {sc.direction === 'in' ? 'IN' : 'OUT'}
                    </span>
                    <span className="flex-1 text-sm text-brand-ink">{formatDateTime(sc.scanned_at)}</span>
                    <span className="tabular text-xs text-brand-muted">{formatTime(sc.scanned_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Request review — creates a dispute trail the admin sees on the dashboard */}
          <div className="mt-4">
            {myReviewRequests(eventId, attendee.id).some((r) => r.status === 'open') ? (
              <Card className="p-4 text-center">
                <p className="flex items-center justify-center gap-1.5 text-sm text-brand-teal"><Check size={15} />Your review request was sent. An organizer will check your record.</p>
              </Card>
            ) : reviewOpen ? (
              <Card className="p-4">
                <Field label="What looks wrong?">
                  <Input
                    value={reviewMsg}
                    onChange={(e) => setReviewMsg(e.target.value)}
                    placeholder="e.g. I scanned in at 9am but it's not showing"
                  />
                </Field>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      requestReview(eventId, attendee.id, reviewMsg)
                      setReviewOpen(false)
                      setReviewMsg('')
                      toast('Review request sent', 'success')
                    }}
                  >
                    Send request
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReviewOpen(false)}>Cancel</Button>
                </div>
              </Card>
            ) : (
              <div className="text-center">
                <Button variant="ghost" size="sm" onClick={() => setReviewOpen(true)}>Something looks wrong? Request a review</Button>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-brand-ink py-8 px-4">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-amber font-display font-bold text-brand-ink shadow-e1">A</span>
          <span className="font-display font-semibold tracking-tight">AWS Student Builder Group</span>
        </div>
        {children}
      </div>
    </div>
  )
}
