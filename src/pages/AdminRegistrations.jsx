import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Card, Button, Badge, Avatar, StatusBadge, EmptyState, QRCode, Field, Input } from '../components/ui.jsx'
import { listAttendeesFrom, approveAttendee, rejectAttendee, registerAttendee } from '../lib/db.js'
import { useEvent } from '../lib/dbHooks.js'
import { useAuth } from '../lib/auth.jsx'
import { sendQrTicket } from '../lib/email.js'
import { toast } from '../components/Toast.jsx'
import { Search, Check, Download, Link2 } from '../components/icons.jsx'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

// Approve one attendee, mint the QR (inside approveAttendee), then email the
// ticket. Email is a convenience channel — a send failure must not block the
// approval (self-service is the guaranteed fallback, §12.12). Returns the
// minted qr_token so callers can pop the QR immediately.
async function approveAndEmail(eventId, attendee, eventName, approvedBy) {
  const { qr_token } = await approveAttendee(eventId, attendee.id, approvedBy)
  // Fire-and-forget email; never throws.
  sendQrTicket({
    toEmail: attendee.email,
    toName: attendee.full_name,
    eventName,
    qrToken: qr_token,
    claimToken: attendee.claim_token,
  })
  return qr_token
}

export default function AdminRegistrations() {
  const { eventId } = useParams()
  const { event, loading } = useEvent(eventId)
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('pending')
  const [adding, setAdding] = useState(false)
  const [qrFor, setQrFor] = useState(null)
  const [query, setQuery] = useState('')

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-8 w-48 animate-pulse rounded bg-brand-surfaceAlt" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-brand-surfaceAlt/60" />
      </AdminLayout>
    )
  }
  if (!event) return <AdminLayout><EmptyState title="Event not found" action={<Button to="/admin">Back</Button>} /></AdminLayout>

  const eventName = event.meta?.name || ''
  const all = listAttendeesFrom(event)
  const counts = {
    pending: all.filter((a) => a.status === 'pending').length,
    approved: all.filter((a) => a.status === 'approved').length,
    rejected: all.filter((a) => a.status === 'rejected').length,
  }
  const q = query.trim().toLowerCase()
  const rows = all
    .filter((a) => a.status === tab)
    .filter((a) => !q || a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))

  return (
    <AdminLayout>
      <PageHeader
        title="Registrations"
        subtitle="Approve attendees to issue their QR. Nothing is issued until you approve."
        actions={<Button onClick={() => setAdding(true)}>+ Add attendee</Button>}
      />

      {adding && <ManualAdd eventId={eventId} eventName={eventName} uid={uid} onClose={() => setAdding(false)} onIssued={(a) => setQrFor(a)} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                tab === t.key ? 'bg-brand-ink text-white shadow-e1' : 'border border-brand-line bg-white text-brand-muted hover:bg-brand-surfaceAlt hover:text-brand-ink'
              }`}
            >
              {t.label} <span className={`ml-1 tabular ${tab === t.key ? 'text-white/70' : 'text-brand-muted'}`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"><Search size={16} /></span>
          <Input
            className="pl-9"
            type="search"
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search attendees by name or email"
          />
        </div>
      </div>

      {tab === 'pending' && rows.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <Button
            size="sm" variant="success"
            onClick={async () => {
              const n = rows.length
              // Sequential to respect EmailJS free-tier throttling (§11).
              for (const a of rows) { await approveAndEmail(eventId, a, eventName, uid) }
              toast(`Approved ${n} attendee${n !== 1 ? 's' : ''} — QR issued`, 'success')
            }}
          >
            Approve all {rows.length}
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={async () => { const n = rows.length; for (const a of rows) { await rejectAttendee(eventId, a.id) } toast(`Rejected ${n} registration${n !== 1 ? 's' : ''}`, 'warn') }}
          >
            Reject all
          </Button>
          <span className="text-xs text-brand-muted">Bulk actions apply to the current view.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={q ? Search : Check}
          title={q ? 'No match' : `No ${tab} registrations`}
          description={q ? `No ${tab} attendee matches "${query}".` : tab === 'pending' ? 'New submissions from the public form appear here for review.' : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-brand-line">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={a.full_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-brand-ink">{a.full_name}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="truncate text-xs text-brand-muted">
                    {a.email} · {a.organization || 'No org'}{a.year_section ? ` · ${a.year_section}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.status === 'pending' && (
                    <>
                      <Button size="sm" variant="success" onClick={async () => { const qr = await approveAndEmail(eventId, a, eventName, uid); toast(`Approved ${a.full_name} — QR issued`, 'success'); setQrFor({ ...a, qr_token: qr, status: 'approved' }) }}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={async () => { await rejectAttendee(eventId, a.id); toast(`Rejected ${a.full_name}`, 'warn') }}>Reject</Button>
                    </>
                  )}
                  {a.status === 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => setQrFor(a)}>View QR</Button>
                  )}
                  {a.status === 'rejected' && (
                    <Button size="sm" variant="ghost" onClick={async () => { await approveAndEmail(eventId, a, eventName, uid); toast(`Restored ${a.full_name}`, 'success') }}>Restore</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {qrFor && <QRModal attendee={qrFor} onClose={() => setQrFor(null)} />}
    </AdminLayout>
  )
}

function ManualAdd({ eventId, eventName, uid, onClose, onIssued }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [yearSection, setYearSection] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return setErr('Name and email are required.')
    setSaving(true)
    setErr('')
    try {
      const res = await registerAttendee(eventId, { full_name: name.trim(), email: email.trim(), organization: org.trim(), year_section: yearSection.trim() })
      if (res.error) { setErr(res.error); setSaving(false); return }
      // Walk-ins are auto-approved and get a QR immediately.
      const attendee = { id: res.id, full_name: name.trim(), email: email.trim(), organization: org.trim(), year_section: yearSection.trim(), claim_token: res.claim_token, status: 'approved' }
      const qr_token = await approveAndEmail(eventId, attendee, eventName, uid)
      onClose()
      onIssued({ ...attendee, qr_token }) // pop the QR straight away for walk-ins
    } catch (_) {
      setErr('Could not add the attendee. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 p-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Add walk-in attendee</h2>
        <p className="text-sm text-brand-muted">Walk-ins are auto-approved and get a QR immediately. The QR pops up right after you add them — show it on screen or download it to hand over.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Full name" error={err}><Input value={name} onChange={(e) => { setName(e.target.value); setErr('') }} /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} /></Field>
          <Field label="Organization"><Input value={org} onChange={(e) => setOrg(e.target.value)} /></Field>
          <Field label="Year & section"><Input value={yearSection} onChange={(e) => setYearSection(e.target.value)} placeholder="BSIT 3-A" /></Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add & issue QR'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function QRModal({ attendee, onClose }) {
  const [copied, setCopied] = useState(false)
  const claimUrl = `${window.location.origin}/me/${attendee.claim_token}`
  const fileBase = attendee.full_name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

  const download = () => {
    // QRCode renders to a <canvas> (id "qr-ticket-svg"), so we export the PNG
    // straight from the canvas. (The old code serialized it as an SVG, which a
    // canvas is not — that produced a broken/empty file.)
    const canvas = document.getElementById('qr-ticket-svg')
    if (!canvas || typeof canvas.toBlob !== 'function') {
      toast('Could not export the QR. Try the self-service link instead.', 'error')
      return
    }
    canvas.toBlob((blob) => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `qr-${fileBase}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(claimUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-sm p-6 text-center animate-rise">
        <div onClick={(e) => e.stopPropagation()}>
          <h3 className="font-display text-lg font-semibold text-brand-ink">{attendee.full_name}</h3>
          <p className="text-sm text-brand-muted">{attendee.email}</p>
          {attendee.year_section && <p className="text-xs text-brand-muted">{attendee.year_section}</p>}
          <div className="mt-4 flex justify-center">
            <div id="qr-ticket">
              <QRCode value={attendee.qr_token} size={220} id="qr-ticket-svg" />
            </div>
          </div>
          <p className="mt-4 text-xs text-brand-muted">
            The attendee shows this at the gate to scan in and out.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={download}><Download size={16} />Download QR</Button>
            <Button variant="outline" onClick={copyLink}>{copied ? <><Check size={16} />Copied</> : <><Link2 size={16} />Copy link</>}</Button>
          </div>

          <div className="mt-3 rounded-xl bg-brand-surfaceAlt p-3 text-left">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">Attendee&rsquo;s self-service link</p>
            <p className="mt-1 break-all text-xs text-brand-ink">{claimUrl}</p>
          </div>

          <Button className="mt-4 w-full" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </Card>
    </div>
  )
}
