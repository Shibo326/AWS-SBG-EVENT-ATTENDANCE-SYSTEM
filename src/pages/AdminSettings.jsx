import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Card, Button, Field, Input, Select, Badge, EmptyState } from '../components/ui.jsx'
import { updateSettings, updateEventMeta, eventTypes } from '../lib/db.js'
import { useEvent } from '../lib/dbHooks.js'
import { totalCountableMinutes, formatDuration } from '../lib/time.js'
import { toast } from '../components/Toast.jsx'
import { Check, Alert } from '../components/icons.jsx'

// datetime-local helpers (render in local time, which for the demo == Manila)
const toLocalInput = (ms) => {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v) => new Date(v).getTime()

// active_windows is stored as an object map {id:{...}} in RTDB (arrays avoided).
// Convert to an array for the form, and back to a map on save.
const windowsToArray = (aw) =>
  Array.isArray(aw) ? aw : aw ? Object.entries(aw).map(([id, w]) => ({ id, ...w })) : []
const windowsToMap = (arr) =>
  Object.fromEntries(arr.map((w) => [w.id, { starts_at: w.starts_at, ends_at: w.ends_at, label: w.label }]))

// Loader wrapper — resolves the event before the form mounts, so the form's
// useState hooks seed from real data instead of undefined (the async break).
export default function AdminSettings() {
  const { eventId } = useParams()
  const { event, loading } = useEvent(eventId)

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-8 w-40 animate-pulse rounded bg-brand-surfaceAlt" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-brand-surfaceAlt/60" />
      </AdminLayout>
    )
  }
  if (!event) {
    return <AdminLayout><EmptyState title="Event not found" action={<Button to="/admin">Back</Button>} /></AdminLayout>
  }
  return <SettingsForm eventId={eventId} event={event} />
}

function SettingsForm({ eventId, event }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const meta = event.meta
  const s = event.settings
  const [name, setName] = useState(meta.name)
  const [type, setType] = useState(meta.event_type)
  const [venue, setVenue] = useState(meta.venue)
  const [validFrom, setValidFrom] = useState(toLocalInput(s.qr_valid_from))
  const [validUntil, setValidUntil] = useState(toLocalInput(s.qr_valid_until))
  const [minHours, setMinHours] = useState(Math.floor(s.min_minutes_required / 60))
  const [minMins, setMinMins] = useState(s.min_minutes_required % 60)
  const [windows, setWindows] = useState(windowsToArray(s.active_windows))
  const [regOpen, setRegOpen] = useState(s.registration_open)

  const minMinutes = (Number(minHours) || 0) * 60 + (Number(minMins) || 0)
  const countable = totalCountableMinutes(windows)
  const conflict = minMinutes > countable

  const save = async () => {
    setSaving(true)
    try {
      await updateEventMeta(eventId, { name, event_type: type, venue })
      await updateSettings(eventId, {
        qr_valid_from: fromLocalInput(validFrom),
        qr_valid_until: fromLocalInput(validUntil),
        min_minutes_required: Number(minMinutes),
        active_windows: windowsToMap(windows),
        registration_open: regOpen,
      })
      setSaved(true)
      toast('Settings saved', 'success')
      setTimeout(() => setSaved(false), 2000)
    } catch (_) {
      toast('Could not save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateWindow = (id, key, val) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, [key]: fromLocalInput(val) } : w)))
  }
  const addWindow = () => {
    const last = windows[windows.length - 1]
    const base = last ? last.ends_at + 12 * 3600000 : Date.now()
    setWindows((ws) => [...ws, { id: 'w_' + Math.random().toString(36).slice(2, 8), starts_at: base, ends_at: base + 8 * 3600000, label: `Window ${ws.length + 1}` }])
  }
  const removeWindow = (id) => setWindows((ws) => ws.filter((w) => w.id !== id))

  return (
    <AdminLayout>
      <PageHeader
        title="Event settings"
        subtitle="Configure this event before it starts. Settings apply to this event only."
        actions={<Button onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? <><Check size={16} />Saved</> : 'Save changes'}</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-display font-semibold text-brand-ink">Basics</h2>
          <div className="space-y-4">
            <Field label="Event name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Event type" hint="Changing this does not overwrite your minimum time below">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {eventTypes().map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Venue"><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-line bg-brand-surfaceAlt p-3.5">
              <input type="checkbox" checked={regOpen} onChange={(e) => setRegOpen(e.target.checked)} className="h-5 w-5 accent-brand-amber" />
              <span className="text-sm font-medium text-brand-ink">Public registration open</span>
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display font-semibold text-brand-ink">QR validity & eligibility</h2>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="QR valid from"><Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
              <Field label="QR valid until"><Input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
            </div>
            <Field label="Minimum time required" hint={`Total: ${formatDuration(minMinutes)}`}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="0" className="w-20 text-center"
                    value={minHours}
                    onChange={(e) => setMinHours(e.target.value)}
                    aria-label="Hours"
                  />
                  <span className="text-sm text-brand-muted">hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="0" max="59" className="w-20 text-center"
                    value={minMins}
                    onChange={(e) => setMinMins(e.target.value)}
                    aria-label="Minutes"
                  />
                  <span className="text-sm text-brand-muted">minutes</span>
                </div>
              </div>
            </Field>
            <div className={`flex items-start gap-2 rounded-xl border p-3.5 text-sm ${conflict ? 'border-brand-red/30 bg-brand-redSoft text-brand-red' : 'border-brand-green/30 bg-brand-greenSoft text-brand-green'}`} role="status">
              <span className="mt-0.5 shrink-0">{conflict ? <Alert size={16} /> : <Check size={16} />}</span>
              <span className="leading-relaxed">
                {conflict ? (
                  <>Minimum (<strong>{formatDuration(minMinutes)}</strong>) is higher than total countable hours (<strong>{formatDuration(countable)}</strong>). No one could qualify.</>
                ) : (
                  <><strong>{formatDuration(countable)}</strong> countable across {windows.length} window{windows.length !== 1 ? 's' : ''}. Requirement is achievable.</>
                )}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-brand-ink">Active windows (countable hours)</h2>
              <p className="text-sm text-brand-muted">Time only counts inside these windows — so overnight and breaks don't inflate totals.</p>
            </div>
            <Button size="sm" variant="outline" onClick={addWindow}>+ Add window</Button>
          </div>
          <div className="space-y-3">
            {windows.map((w) => (
              <div key={w.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-line bg-brand-surfaceAlt p-3.5">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-brand-muted">Label</label>
                  <Input className="h-9" value={w.label} onChange={(e) => setWindows((ws) => ws.map((x) => x.id === w.id ? { ...x, label: e.target.value } : x))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-muted">Starts</label>
                  <Input className="h-9" type="datetime-local" value={toLocalInput(w.starts_at)} onChange={(e) => updateWindow(w.id, 'starts_at', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-muted">Ends</label>
                  <Input className="h-9" type="datetime-local" value={toLocalInput(w.ends_at)} onChange={(e) => updateWindow(w.id, 'ends_at', e.target.value)} />
                </div>
                <Badge tone="teal">{formatDuration(Math.max(0, (w.ends_at - w.starts_at) / 60000))}</Badge>
                {windows.length > 1 && <Button size="sm" variant="ghost" onClick={() => removeWindow(w.id)}>Remove</Button>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
