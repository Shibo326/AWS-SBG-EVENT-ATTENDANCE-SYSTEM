import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Button, Field, Input } from '../components/ui.jsx'
import { getEvent, registerAttendee, eventTypeInfo } from '../lib/store.js'
import { useStore } from '../lib/hooks.js'
import { formatDuration } from '../lib/time.js'
import { Search, Lock, Check, Alert, MapPin, ArrowRight } from '../components/icons.jsx'

export default function PublicRegister() {
  useStore()
  const { eventId } = useParams()
  const event = getEvent(eventId)
  const [form, setForm] = useState({ full_name: '', email: '', organization: '', year_section: '' })
  const [consent, setConsent] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)

  if (!event) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-surfaceAlt text-brand-muted"><Search size={26} /></div>
          <h1 className="mt-3 font-display text-xl font-bold text-brand-ink">Event not found</h1>
          <p className="mt-1 text-sm text-brand-muted">This registration link is invalid or the event was removed.</p>
        </Card>
      </Shell>
    )
  }

  const meta = event.meta
  const s = event.settings

  if (!s.registration_open && !done) {
    return (
      <Shell>
        <EventHeader meta={meta} settings={s} />
        <Card className="mt-4 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-surfaceAlt text-brand-muted"><Lock size={24} /></div>
          <h2 className="mt-3 font-display text-lg font-bold text-brand-ink">Registration is closed</h2>
          <p className="mt-1 text-sm text-brand-muted">The organizer has closed registration for this event.</p>
        </Card>
      </Shell>
    )
  }

  const submit = (e) => {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim()) return setErr('Name and email are required.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErr('Enter a valid email address.')
    if (!consent) return setErr('Please agree to the privacy notice to continue.')
    const res = registerAttendee(eventId, { ...form, full_name: form.full_name.trim(), email: form.email.trim() })
    if (res.error) return setErr(res.error)
    setDone(res)
  }

  if (done) {
    return (
      <Shell>
        <EventHeader meta={meta} settings={s} />
        <Card className="mt-4 p-8 text-center animate-rise">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-greenSoft text-brand-green"><Check size={30} /></div>
          <h2 className="mt-4 font-display text-xl font-bold text-brand-ink">You&rsquo;re registered!</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-muted">
            Your registration is pending admin approval. Once approved, your QR ticket appears on your personal page below (and is emailed to you).
          </p>
          <div className="mt-5 rounded-xl border border-brand-line bg-brand-surfaceAlt p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-amberDark">Save this link — it&rsquo;s your ticket</p>
            <Link to={`/me/${done.claim_token}`} className="mt-1.5 block break-all text-sm font-medium text-brand-ink underline decoration-brand-amber decoration-2 underline-offset-2 hover:text-brand-amberDark">
              {window.location.origin}/me/{done.claim_token}
            </Link>
          </div>
          <Button className="mt-5 w-full" size="lg" to={`/me/${done.claim_token}`}>Go to my page<ArrowRight size={16} /></Button>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <EventHeader meta={meta} settings={s} />
      <Card className="mt-4 p-6">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Register</h2>
        <p className="mt-1 text-sm text-brand-muted">Takes under a minute. We&rsquo;ll email your QR ticket once an organizer approves.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Full name" required htmlFor="reg-name" error={err && !form.full_name ? err : ''}>
            <Input id="reg-name" value={form.full_name} onChange={(e) => { setForm({ ...form, full_name: e.target.value }); setErr('') }} placeholder="Juan Dela Cruz" autoComplete="name" invalid={!!(err && !form.full_name)} />
          </Field>
          <Field label="Email" required htmlFor="reg-email" hint="Your QR ticket is sent here.">
            <Input id="reg-email" type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setErr('') }} placeholder="you@student.sti.edu" autoComplete="email" />
          </Field>
          <Field label="School / organization" htmlFor="reg-org">
            <Input id="reg-org" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="STI Global City" />
          </Field>
          <Field label="Year & section" htmlFor="reg-yearsec" hint="e.g. BSIT 3-A">
            <Input id="reg-yearsec" value={form.year_section} onChange={(e) => setForm({ ...form, year_section: e.target.value })} placeholder="BSIT 3-A" />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-line bg-brand-surfaceAlt p-3.5">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr('') }} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-amber" />
            <span className="text-sm leading-relaxed text-brand-slate">
              I agree that my name, email, and organization will be used for attendance tracking and certificate eligibility for this event, per the Data Privacy Act (RA 10173).
            </span>
          </label>
          {err && (
            <p className="flex items-center gap-1.5 rounded-lg bg-brand-redSoft px-3 py-2 text-sm font-medium text-brand-red" role="alert">
              <Alert size={15} className="shrink-0" />{err}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full">Submit registration</Button>
        </form>
      </Card>
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

function EventHeader({ meta, settings }) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-brand-navy p-5 text-white">
        <span className="inline-flex rounded-full bg-brand-amber px-2.5 py-0.5 text-xs font-semibold text-brand-ink">{eventTypeInfo(meta.event_type).label}</span>
        <h1 className="mt-2.5 font-display text-xl font-bold tracking-tight">{meta.name}</h1>
        {meta.venue && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70"><MapPin size={14} className="shrink-0" />{meta.venue}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="text-sm text-brand-muted">Certificate requirement</span>
        <span className="rounded-full bg-brand-amberSoft px-3 py-1 text-sm font-semibold text-brand-amberDark">
          {formatDuration(settings.min_minutes_required)} inside
        </span>
      </div>
    </Card>
  )
}
