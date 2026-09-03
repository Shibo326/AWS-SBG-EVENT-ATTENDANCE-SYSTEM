// Minimal toast system — no dependency. `toast('Saved')` from anywhere;
// <ToastHost/> mounts once near the app root and renders them.

import { useEffect, useState } from 'react'

let push = null
let counter = 0

export function toast(message, tone = 'default') {
  if (push) push({ id: ++counter, message, tone })
}

export function ToastHost() {
  const [items, setItems] = useState([])

  useEffect(() => {
    push = (t) => {
      setItems((cur) => [...cur, t])
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 2600)
    }
    return () => { push = null }
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
          className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-e3 animate-rise ${tones[t.tone] || tones.default}`}
          role="status"
        >
          {t.tone === 'success' && <span aria-hidden="true">✓</span>}
          {t.tone === 'error' && <span aria-hidden="true">✕</span>}
          {t.tone === 'warn' && <span aria-hidden="true">⚠</span>}
          {t.message}
        </div>
      ))}
    </div>
  )
}
