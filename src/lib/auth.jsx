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

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // Firebase user or null
  const [staff, setStaff] = useState(null)    // /staff/{uid} record or null
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
