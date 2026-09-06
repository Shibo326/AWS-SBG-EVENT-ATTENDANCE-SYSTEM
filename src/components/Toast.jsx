// Minimal toast system — no dependency. `toast('Saved')` from anywhere;
// <ToastHost/> mounts once near the app root and renders them.
// `toastAction(...)` adds an inline action button (e.g. Undo) with a longer window.

import { useEffect, useState } from 'react'
import { Check, X, Alert } from './icons.jsx'

let push = null
let dismiss = null
let counter = 0

export function toast(message, tone = 'default') {
  if (push) push({ id: ++counter, message, tone, ttl: 2600 })
}

/**
 * Toast with an action button (e.g. Undo). The action fires the callback and
 * dismisses the toast. Stays up longer (default 5s) so the user can react.
 */
export function toastAction(message, actionLabel, onAction, tone = 'default', ttl = 5000) {
  if (push) push({ id: ++counter, message, tone, actionLabel, onAction, ttl })
}

export function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    push = (t) => {
      setItems((cur) => [...cur, t])
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), t.ttl || 2600)
    }
    dismiss = (id) => setItems((cur) => cur.filter((x) => x.id !== id))
    return () => { push = null; dismiss = null }
  }, [])

  const tones = {
    default: 'bg-brand-ink text-white',
    success: 'bg-brand-green text-white',
    warn: 'bg-brand-amberDark text-brand-ink',
    error: 'bg-brand-red text-white',
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium shadow-e3 animate-rise ${tones[t.tone] || tones.default}`}
          role="status"
        >
          <span className="flex items-center gap-2">
            {t.tone === 'success' && <Check size={16} className="shrink-0" />}
            {t.tone === 'error' && <X size={16} className="shrink-0" />}
            {t.tone === 'warn' && <Alert size={16} className="shrink-0" />}
            {t.message}
          </span>
          {t.actionLabel && (
            <button
              onClick={() => { t.onAction?.(); dismiss?.(t.id) }}
              className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
