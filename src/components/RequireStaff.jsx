// Route gate for staff-only surfaces. `role="admin"` restricts to admins
// (the /admin panel); `role="staff"` allows any active staff incl. gate_staff
// (the /scan page). Public routes (/register, /me) are NOT wrapped.
//
// This is a UX gate. The real access boundary is the Firebase Security Rules
// (§9): even if someone bypassed this component, the rules deny the reads and
// writes their role isn't allowed.

import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { Card, Button, Field, Input } from './ui.jsx'
import { Lock, Alert } from './icons.jsx'

function LoginScreen({ note }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await signIn(email.trim(), password)
    } catch (_) {
      setErr('Sign-in failed. Check your email and password.')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-ink px-4 py-16">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-amber font-display font-bold text-brand-ink">A</span>
          <span className="font-display font-semibold tracking-tight">SBG Attendance</span>
        </div>
        <Card className="p-6">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-surfaceAlt text-brand-muted"><Lock size={22} /></div>
          <h1 className="mt-3 text-center font-display text-lg font-bold text-brand-ink">Staff sign-in</h1>
          <p className="mt-1 text-center text-sm text-brand-muted">{note || 'Sign in with your organizer account.'}</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
            {err && (
              <p className="flex items-center gap-1.5 rounded-lg bg-brand-redSoft px-3 py-2 text-sm font-medium text-brand-red" role="alert">
                <Alert size={15} className="shrink-0" />{err}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

function Denied({ signOut }) {
  return (
    <div className="min-h-screen bg-brand-ink px-4 py-16">
      <div className="mx-auto max-w-sm">
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-redSoft text-brand-red"><Lock size={22} /></div>
          <h1 className="mt-3 font-display text-lg font-bold text-brand-ink">No access</h1>
          <p className="mt-1 text-sm text-brand-muted">This account isn&rsquo;t authorized for this area. Ask an admin to add your account to the staff list.</p>
          <Button className="mt-4 w-full" variant="outline" onClick={signOut}>Sign out</Button>
        </Card>
      </div>
    </div>
  )
}

export default function RequireStaff({ role = 'staff', children }) {
  const { user, loading, isAdmin, isGateStaff, signOut } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-brand-ink">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-amber" />
      </div>
    )
  }
  if (!user) {
    return <LoginScreen note={role === 'admin' ? 'Admin access required.' : 'Gate staff sign-in.'} />
  }
  const ok = role === 'admin' ? isAdmin : isGateStaff
  if (!ok) return <Denied signOut={signOut} />
  return children
}
