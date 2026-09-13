import { useState, useEffect } from 'react'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Card, Button, Badge, Field, Input, Select, EmptyState, Avatar } from '../components/ui.jsx'
import { subscribeStaff, upsertStaff, setStaffActive } from '../lib/db.js'
import { useAuth } from '../lib/auth.jsx'
import { toast } from '../components/Toast.jsx'
import { Plus, Check, X, Search } from '../components/icons.jsx'

// Staff management (PROJECT_PLAN Admin Flow step 4 / §9.2). The global /staff
// node holds each account's role (admin | gate_staff) + active flag. Firebase
// Auth users are created out-of-band (a client-side createUser would sign the
// admin out), so the flow is: create the Auth user in the Firebase Console,
// then grant them a role here by their Auth UID.

export default function AdminStaff() {
  const { user } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const unsub = subscribeStaff(
      (list) => { setStaff(list); setLoading(false) },
      () => setLoading(false),
    )
    return unsub
  }, [])

  const toggleActive = async (s) => {
    if (s.uid === user?.uid && s.active) {
      toast("You can't deactivate your own account.", 'warn')
      return
    }
    try {
      await setStaffActive(s.uid, !s.active)
      toast(`${s.display_name || s.email || 'Account'} ${s.active ? 'deactivated' : 'reactivated'}`, s.active ? 'warn' : 'success')
    } catch (_) {
      toast('Could not update the account.', 'error')
    }
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Staff accounts"
        subtitle="Admins and gate staff who can sign in. Gate staff can only run the scanner — they can't see the attendee roster."
        actions={<Button onClick={() => setAdding(true)}><Plus size={16} />Add staff</Button>}
      />

      {adding && <AddStaffForm onClose={() => setAdding(false)} />}

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-brand-surfaceAlt/60" />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No staff accounts yet"
          description="Add your first organizer or gate volunteer. Create their login in the Firebase Console, then grant a role here with their Auth UID."
          action={<Button onClick={() => setAdding(true)}><Plus size={16} />Add staff</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-brand-line">
            {staff.map((s) => (
              <li key={s.uid} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={s.display_name || s.email || '?'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-brand-ink">{s.display_name || '(no name)'}</p>
                    <Badge tone={s.role === 'admin' ? 'amber' : 'teal'}>{s.role === 'admin' ? 'Admin' : 'Gate staff'}</Badge>
                    {s.active
                      ? <Badge tone="green"><Check size={12} />Active</Badge>
                      : <Badge tone="gray"><X size={12} />Disabled</Badge>}
                    {s.uid === user?.uid && <span className="text-xs text-brand-muted">(you)</span>}
                  </div>
                  <p className="truncate text-xs text-brand-muted">{s.email || 'no email on record'} · {s.uid}</p>
                </div>
                <Button
                  size="sm"
                  variant={s.active ? 'outline' : 'success'}
                  onClick={() => toggleActive(s)}
                  disabled={s.uid === user?.uid && s.active}
                >
                  {s.active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminLayout>
  )
}

function AddStaffForm({ onClose }) {
  const [uid, setUid] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('gate_staff')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!uid.trim()) return setErr('Paste the Firebase Auth UID (Authentication → Users → copy UID).')
    setSaving(true)
    setErr('')
    try {
      const res = await upsertStaff(uid.trim(), { role, display_name: name, email })
      if (res.error) { setErr(res.error); setSaving(false); return }
      toast(`${name || email || 'Account'} added as ${role === 'admin' ? 'admin' : 'gate staff'}`, 'success')
      onClose()
    } catch (_) {
      setErr('Could not save. Only an admin can add staff, and you must be signed in.')
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 p-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Add a staff account</h2>
        <div className="rounded-xl border border-brand-line bg-brand-surfaceAlt p-3.5 text-sm text-brand-slate">
          <p className="font-medium text-brand-ink">Two quick steps:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>In the Firebase Console → Authentication → Users → <strong>Add user</strong> (email + password). Copy the generated <strong>User UID</strong>.</li>
            <li>Paste that UID below and pick a role. Share the email + password with the volunteer.</li>
          </ol>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Firebase Auth UID" required error={err} htmlFor="st-uid">
            <Input id="st-uid" value={uid} onChange={(e) => { setUid(e.target.value); setErr('') }} placeholder="e.g. kJ3f9aB2cD..." />
          </Field>
          <Field label="Role" htmlFor="st-role">
            <Select id="st-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="gate_staff">Gate staff (scanner only)</option>
              <option value="admin">Admin (full access)</option>
            </Select>
          </Field>
          <Field label="Display name" htmlFor="st-name">
            <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Dela Cruz" />
          </Field>
          <Field label="Email (for reference)" htmlFor="st-email">
            <Input id="st-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="volunteer@awssbg.dev" />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add staff'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
