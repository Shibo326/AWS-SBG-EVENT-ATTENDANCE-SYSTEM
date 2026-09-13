import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Button, Card, Badge, Field, Input, Select, EmptyState } from '../components/ui.jsx'
import { createEvent, setEventStatus, eventStatsFrom, eventTypeInfo, eventTypes } from '../lib/db.js'
import { useEvents } from '../lib/dbHooks.js'
import { useAuth } from '../lib/auth.jsx'
import { formatDate } from '../lib/time.js'
import { toast } from '../components/Toast.jsx'
import { Plus, Ticket, ArrowRight } from '../components/icons.jsx'

const statusTone = { active: 'green', draft: 'gray', ended: 'blue', archived: 'muted' }

const NewEventLabel = () => <><Plus size={16} />New event</>

export default function AdminHome() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { events, loading } = useEvents()

  const archivedCount = events.filter((e) => e.meta?.status === 'archived').length
  const visible = showArchived ? events : events.filter((e) => e.meta?.status !== 'archived')

  // Move an event through its lifecycle: draft → active → ended, archive, or
  // restore an archived one back to draft. Reversible (Module 0).
  const changeStatus = async (ev, status) => {
    try {
      await setEventStatus(ev.id, status)
      const label = { active: 'activated', ended: 'ended', archived: 'archived', draft: 'restored to draft' }[status]
      toast(`${ev.meta?.name || 'Event'} ${label}`, status === 'archived' ? 'warn' : 'success')
    } catch (_) {
      toast('Could not update the event status.', 'error')
    }
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Events"
        subtitle="Every event the AWS SBG team manages. Open one to run it, or create a new one."
        actions={
          <>
            {archivedCount > 0 && (
              <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
              </Button>
            )}
            <Button onClick={() => setCreating(true)}><NewEventLabel /></Button>
          </>
        }
      />

      {creating && <CreateEventForm onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/event/${id}/settings`)} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-brand-surfaceAlt/60" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={events.length === 0 ? 'No events yet' : 'No active events'}
          description={events.length === 0
            ? 'Create your first event to start registering attendees and tracking time.'
            : 'All events are archived. Use “Show archived” to see them.'}
          action={<Button onClick={() => setCreating(true)}><NewEventLabel /></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((ev) => {
            const meta = ev.meta || {}
            const s = eventStatsFrom(ev)
            const isLive = meta.status === 'active'
            return (
              <Card key={ev.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone={statusTone[meta.status] || 'gray'}>
                    {isLive && <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse-ring" aria-hidden="true" />}
                    {meta.status}
                  </Badge>
                  <span className="text-xs font-medium text-brand-muted">{eventTypeInfo(meta.event_type).label}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold text-brand-ink">{meta.name}</h3>
                <p className="mt-1 text-sm text-brand-muted">{meta.venue || 'No venue set'}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Inside" value={s.inside} tone="teal" />
                  <Mini label="Registered" value={s.registered} />
                  <Mini label="Eligible" value={s.eligible} tone="amber" />
                </div>

                {/* Lifecycle controls (Module 0). draft can't be scanned until
                    activated; ended stops new time; archive hides + is reversible. */}
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-brand-line pt-3">
                  {meta.status === 'draft' && (
                    <Button size="sm" variant="success" onClick={() => changeStatus(ev, 'active')}>Activate</Button>
                  )}
                  {meta.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(ev, 'ended')}>End event</Button>
                  )}
                  {meta.status === 'ended' && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus(ev, 'active')}>Re-open</Button>
                  )}
                  {meta.status === 'archived' ? (
                    <Button size="sm" variant="ghost" onClick={() => changeStatus(ev, 'draft')}>Restore</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => changeStatus(ev, 'archived')}>Archive</Button>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-xs text-brand-muted">Created {meta.created_at ? formatDate(meta.created_at) : '—'}</span>
                  <Button size="sm" to={`/admin/event/${ev.id}`}>Open<ArrowRight size={15} /></Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}

function Mini({ label, value, tone = 'ink' }) {
  const c = { ink: 'text-brand-ink', teal: 'text-brand-teal', green: 'text-brand-green', amber: 'text-brand-amberDark' }[tone]
  return (
    <div className="rounded-xl bg-brand-surfaceAlt py-2.5">
      <div className={`font-display text-lg font-bold tabular ${c}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-brand-muted">{label}</div>
    </div>
  )
}

function CreateEventForm({ onClose, onCreated }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [type, setType] = useState('seminar')
  const [venue, setVenue] = useState('')
  const [err, setErr] = useState('')

  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give the event a name.')
    setSaving(true)
    try {
      const id = await createEvent({ name: name.trim(), event_type: type, venue: venue.trim(), created_by: user?.uid })
      onCreated(id)
    } catch (_) {
      setErr('Could not create the event. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 p-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Create a new event</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" error={err} htmlFor="ev-name">
            <Input id="ev-name" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} placeholder="e.g. AWS Cloud Foundations Seminar" />
          </Field>
          <Field label="Event type" hint="Sets the default minimum time requirement" htmlFor="ev-type">
            <Select id="ev-type" value={type} onChange={(e) => setType(e.target.value)}>
              {eventTypes().map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Venue (optional)" htmlFor="ev-venue">
          <Input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. STI Global City — Room 501" />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create & configure'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
