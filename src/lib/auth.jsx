// Auth + staff-role context (PROJECT_PLAN §5.1 / §9.2).
//
// Firebase Auth identifies the user; the /staff/{uid} node carries the ROLE
// (admin | gate_staff) and an `active` flag. Roles live in the database (and
// are enforced by the security rules), never hard-coded in the client — the UI
// gate here is convenience, the rules are the real boundary (§9).

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db } from './firebase.js'
import { isFirebaseConfigured } from './firebase.js'

const AuthContext = createContext(null)

// When there is no Firebase backend yet (no .env), the app runs in a local
// preview mode: a stand-in admin is signed in automatically so the UI is fully
// browsable without a backend. This is DEV-ONLY convenience — with real config,
// this branch is skipped entirely and Firebase Auth governs access.
const DEV_NO_BACKEND = !isFirebaseConfigured()
const DEV_STAFF = { uid: 'dev-admin', role: 'admin', display_name: 'Dev Admin', active: true }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEV_NO_BACKEND ? { uid: 'dev-admin' } : null)
  const [staff, setStaff] = useState(DEV_NO_BACKEND ? DEV_STAFF : null)
  const [loading, setLoading] = useState(!DEV_NO_BACKEND)

  useEffect(() => {
    // No backend configured, or Firebase failed to init — skip auth wiring and
    // stay in local preview mode. Nothing to subscribe to.
    if (DEV_NO_BACKEND || !auth) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          const snap = await get(ref(db, `staff/${u.uid}`))
          setStaff(snap.exists() ? { uid: u.uid, ...snap.val() } : null)
        } catch (_) {
          setStaff(null)
        }
      } else {
        setStaff(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = useCallback(async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await get(ref(db, `staff/${cred.user.uid}`))
    const s = snap.exists() ? { uid: cred.user.uid, ...snap.val() } : null
    setStaff(s)
    return s
  }, [])

  const signOut = useCallback(async () => {
    await fbSignOut(auth)
    setStaff(null)
  }, [])

  const role = staff?.active ? staff.role : null
  const value = {
    user,
    staff,
    loading,
    signIn,
    signOut,
    isAdmin: role === 'admin',
    isGateStaff: role === 'gate_staff' || role === 'admin',
    role,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
