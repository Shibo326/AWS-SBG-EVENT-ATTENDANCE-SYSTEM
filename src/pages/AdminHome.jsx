import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Button, Card, Badge, Field, Input, Select, EmptyState } from '../components/ui.jsx'
import { listEvents, createEvent, eventStats, eventTypeInfo, eventTypes } from '../lib/store.js'
import { useStore } from '../lib/hooks.js'
import { formatDate } from '../lib/time.js'
import { Plus, Ticket, ArrowRight } from '../components/icons.jsx'

const statusTone = { active: 'green', draft: 'gray', ended: 'blue', archived: 'muted' }

const NewEventLabel = () => <><Plus size={16} />New event</>

export default function AdminHome() {
  useStore()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const events = listEvents()

  return (
    <AdminLayout>
      <PageHeader
        title="Events"
        subtitle="Every event the AWS SBG team manages. Open one to run it, or create a new one."
        actions={<Button onClick={() => setCreating(true)}><NewEventLabel /></Button>}
      />

      {creating && <CreateEventForm onClose={() => setCreating(false)} onCreated={(id) => navigate(`/admin/event/${id}/settings`)} />}

      {events.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No events yet"
          description="Create your first event to start registering attendees and tracking time."
          action={<Button onClick={() => setCreating(true)}><NewEventLabel /></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const s = eventStats(ev.id)
            const isLive = ev.status === 'active'
            return (
              <Card key={ev.id} interactive className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone={statusTone[ev.status] || 'gray'}>
                    {isLive && <span className="h-1.5 w-1.5 rounded-full bg-brand-green animate-pulse-ring" aria-hidden="true" />}
                    {ev.status}
                  </Badge>
                  <span className="text-xs font-medium text-brand-muted">{eventTypeInfo(ev.event_type).label}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-semibold text-brand-ink">{ev.name}</h3>
                <p className="mt-1 text-sm text-brand-muted">{ev.venue || 'No venue set'}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Inside" value={s.inside} tone="teal" />
                  <Mini label="Registered" value={s.registered} />
                  <Mini label="Eligible" value={s.eligible} tone="amber" />
                </div>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <span className="text-xs text-brand-muted">Created {formatDate(ev.created_at)}</span>
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
  const [name, setName] = useState('')
  const [type, setType] = useState('seminar')
  const [venue, setVenue] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Give the event a name.')
    const id = createEvent({ name: name.trim(), event_type: type, venue: venue.trim() })
    onCreated(id)
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
          <Button type="submit">Create & configure</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
