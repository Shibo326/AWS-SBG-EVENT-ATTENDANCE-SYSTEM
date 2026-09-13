// Frontend-only UI hooks preserved through the Firebase migration.
// Data reactivity now lives in dbHooks.js (useEvents / useEvent / useNow) over
// live RTDB subscriptions. These two are pure UI concerns the data layer never
// owned: keeping the gate screen awake, and the persisted dark-mode theme.

import { useEffect, useState } from 'react'

/**
 * Keep the screen awake while `active` is true (Screen Wake Lock API).
 * Gate scanning happens with the phone held up for long stretches; without this
 * the screen dims/sleeps mid-queue. Re-acquires the lock when the tab returns to
 * the foreground (the browser drops it on visibility change). No-ops where the
 * API is unsupported (older iOS Safari) — harmless.
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel = null
    let released = false

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch (_) {
        // permission or policy denied — ignore, scanning still works
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (sentinel) sentinel.release().catch(() => {})
    }
  }, [active])
}

/**
 * Dark-mode theme, persisted to localStorage and applied as a `.dark` class on
 * <html> (Tailwind darkMode: 'class'). Returns [isDark, toggle].
 */
const THEME_KEY = 'sbg_theme'

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved) return saved === 'dark'
    } catch (_) {}
    return false // default to light (the designed default)
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light') } catch (_) {}
  }, [isDark])

  return [isDark, () => setIsDark((v) => !v)]
}
