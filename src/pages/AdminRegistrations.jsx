import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Card, Button, Badge, Avatar, StatusBadge, EmptyState, QRCode, Field, Input } from '../components/ui.jsx'
import { getEvent, listAttendees, approveAttendee, rejectAttendee, restoreAttendee, registerAttendee, getAttendee } from '../lib/store.js'
import { useStore } from '../lib/hooks.js'
import { toast, toastAction } from '../components/Toast.jsx'
import { Search, Check, Download, Link2 } from '../components/icons.jsx'

// Reject one attendee, capturing prior state, and offer an Undo toast.
function rejectWithUndo(eventId, attendee) {
  const prev = rejectAttendee(eventId, attendee.id)
  toastAction(`Rejected ${attendee.full_name}`, 'Undo', () => restoreAttendee(eventId, attendee.id, prev), 'warn')
}

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function AdminRegistrations() {
  useStore()
  const { eventId } = useParams()
  const [tab, setTab] = useState('pending')
  const [adding, setAdding] = useState(false)
  const [qrFor, setQrFor] = useState(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const event = getEvent(eventId)

  if (!event) return <AdminLayout><EmptyState title="Event not found" action={<Button to="/admin">Back</Button>} /></AdminLayout>

  const all = listAttendees(eventId)
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

      {adding && <ManualAdd eventId={eventId} onClose={() => setAdding(false)} onIssued={(a) => setQrFor(a)} />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(new Set()) }}
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

      {tab === 'pending' && rows.length > 0 && (() => {
        const selectedRows = rows.filter((a) => selected.has(a.id))
        const hasSelection = selectedRows.length > 0
        const targets = hasSelection ? selectedRows : rows
        const scopeLabel = hasSelection ? `${selectedRows.length} selected` : `all ${rows.length}`
        const doApprove = () => {
          targets.forEach((a) => approveAttendee(eventId, a.id))
          toast(`Approved ${targets.length} attendee${targets.length !== 1 ? 's' : ''} — QR issued`, 'success')
          setSelected(new Set())
        }
        const doReject = () => {
          const snapshot = targets.map((a) => ({ id: a.id, prev: rejectAttendee(eventId, a.id) }))
          toastAction(
            `Rejected ${targets.length} registration${targets.length !== 1 ? 's' : ''}`,
            'Undo',
            () => snapshot.forEach((s) => restoreAttendee(eventId, s.id, s.prev)),
            'warn',
          )
          setSelected(new Set())
        }
        return (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-brand-muted">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-amber"
                checked={selected.size > 0 && rows.every((a) => selected.has(a.id))}
                ref={(el) => { if (el) el.indeterminate = hasSelection && !rows.every((a) => selected.has(a.id)) }}
                onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((a) => a.id)) : new Set())}
              />
              Select all
            </label>
            <Button size="sm" variant="success" onClick={doApprove}>Approve {scopeLabel}</Button>
            <Button size="sm" variant="outline" onClick={doReject}>Reject {scopeLabel}</Button>
            {hasSelection && (
              <button onClick={() => setSelected(new Set())} className="text-xs text-brand-muted underline hover:text-brand-ink">
                Clear selection
              </button>
            )}
          </div>
        )
      })()}

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
                {tab === 'pending' && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand-amber"
                    checked={selected.has(a.id)}
                    onChange={(e) => setSelected((cur) => {
                      const next = new Set(cur)
                      if (e.target.checked) next.add(a.id); else next.delete(a.id)
                      return next
                    })}
                    aria-label={`Select ${a.full_name}`}
                  />
                )}
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
                      <Button size="sm" variant="success" onClick={() => { approveAttendee(eventId, a.id); toast(`Approved ${a.full_name} — QR issued`, 'success') }}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => rejectWithUndo(eventId, a)}>Reject</Button>
                    </>
                  )}
                  {a.status === 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => setQrFor(a)}>View QR</Button>
                  )}
                  {a.status === 'rejected' && (
                    <Button size="sm" variant="ghost" onClick={() => { approveAttendee(eventId, a.id); toast(`Restored ${a.full_name}`, 'success') }}>Restore</Button>
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

function ManualAdd({ eventId, onClose, onIssued }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [yearSection, setYearSection] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return setErr('Name and email are required.')
    const res = registerAttendee(eventId, { full_name: name.trim(), email: email.trim(), organization: org.trim(), year_section: yearSection.trim() })
    if (res.error) return setErr(res.error)
    approveAttendee(eventId, res.id) // walk-ins are auto-approved
    const issued = getAttendee(eventId, res.id)
    onClose()
    if (issued) onIssued(issued) // pop the QR straight away for walk-ins
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
          <Button type="submit">Add & issue QR</Button>
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
    const svg = document.getElementById('qr-ticket-svg')
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 3
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `qr-${fileBase}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
      }, 'image/png')
    }
    img.src = url
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
