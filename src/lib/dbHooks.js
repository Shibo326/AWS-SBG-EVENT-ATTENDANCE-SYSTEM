// React hooks over the async Firebase data layer (db.js).
//
// These replace the mock store's synchronous useStore() pattern. Instead of a
// global "something changed, re-read everything" broadcast, each hook holds a
// live RTDB subscription and returns { data, loading }. Pages branch on
// `loading` so they don't false-trigger a "not found" state on first render
// before the async snapshot arrives (the core hazard from the mock migration).

import { useEffect, useState } from 'react'
import { subscribeEvents, subscribeEvent } from './db.js'

/**
 * Live list of all events (full snapshots incl. meta/settings/attendees so the
 * derived helpers can run without extra reads). Returns { events, loading }.
 */
export function useEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    const unsub = subscribeEvents(
      (list) => { setEvents(list); setError(null); setLoading(false) },
      (err) => {
        // A denied/failed read must clear loading — otherwise the page spins
        // forever. Surface the error so the UI can show it instead.
        console.error('[useEvents] read failed:', err?.message || err)
        setError(err); setLoading(false)
      },
    )
    return unsub
  }, [])
  return { events, loading, error }
}

/**
 * Live snapshot of one event's full subtree. Returns { event, loading }.
 * `event` is null once loaded if the event does not exist.
 */
export function useEvent(eventId) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!eventId) {
      setEvent(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const unsub = subscribeEvent(
      eventId,
      (snap) => { setEvent(snap); setError(null); setLoading(false) },
      (err) => {
        console.error('[useEvent] read failed:', err?.message || err)
        setError(err); setLoading(false)
      },
    )
    return unsub
  }, [eventId])
  return { event, loading, error }
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
