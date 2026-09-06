import { useEffect, useState } from 'react'
import { subscribe } from './store.js'

/** Re-render the component whenever the mock store changes. */
export function useStore() {
  const [, setTick] = useState(0)
  useEffect(() => subscribe(() => setTick((t) => t + 1)), [])
}

/** A ticking clock so live timers update. Returns Date.now(), refreshed every `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

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
