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
