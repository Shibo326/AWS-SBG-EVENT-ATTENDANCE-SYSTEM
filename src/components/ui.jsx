// Shared design-system primitives.
//
// Direction: "campus event, warm but credible" (see tailwind.config.js).
// Warm ink on paper, ONE amber accent, teal reserved for live/active state,
// a single layered-elevation scale (e1..e3), one radius language (xl / full).
// Every interactive element has a visible focus ring and a >=44px touch target.

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import QRCodeLib from 'qrcode'
import { Alert, Inbox, Sun, Moon } from './icons.jsx'

const RADIUS = 'rounded-xl'

/* ── Button ──────────────────────────────────────────────────────────────
   One primary style (amber). Secondary/outline/ghost are quieter. Danger and
   success carry semantic weight. 44px min height, generous horizontal padding. */
export function Button({ variant = 'primary', size = 'md', as, to, className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium tracking-tight ' +
    'transition-[background-color,box-shadow,transform] duration-150 active:translate-y-px ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 ' + RADIUS
  const sizes = {
    sm: 'h-9 px-3.5 text-sm',
    md: 'h-11 px-5 text-sm',      // 44px min touch target
    lg: 'h-12 px-7 text-base',
  }
  const variants = {
    primary: 'bg-brand-amber text-brand-ink on-accent shadow-e1 hover:bg-brand-amberDark hover:shadow-e2',
    secondary: 'bg-brand-ink text-white shadow-e1 hover:bg-brand-navy hover:shadow-e2',
    outline: 'border border-brand-line bg-white text-brand-ink hover:bg-brand-surfaceAlt dark:bg-brand-darkCard dark:border-brand-darkLine dark:text-brand-surface dark:hover:bg-brand-navy',
    ghost: 'bg-transparent text-brand-muted hover:bg-brand-surfaceAlt hover:text-brand-ink dark:hover:bg-brand-navy dark:hover:text-brand-surface',
    danger: 'bg-brand-red text-white shadow-e1 hover:brightness-110',
    success: 'bg-brand-green text-white shadow-e1 hover:brightness-110',
  }
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>
  const Tag = as || 'button'
  return <Tag className={cls} {...props}>{children}</Tag>
}

/* ── Card ───────────────────────────────────────────────────────────────── */
export function Card({ className = '', interactive = false, children }) {
  const lift = interactive
    ? 'shadow-e1 transition-shadow hover:shadow-e2'
    : 'shadow-e1'
  return (
    <div className={`bg-white dark:bg-brand-darkCard dark:border-brand-darkLine ${RADIUS} border border-brand-line ${lift} ${className}`}>
      {children}
    </div>
  )
}

/* ── Badge ──────────────────────────────────────────────────────────────── */
export function Badge({ tone = 'muted', children }) {
  const tones = {
    green: 'bg-brand-greenSoft text-brand-green ring-brand-green/20 dark:bg-brand-green/20 dark:text-emerald-300',
    amber: 'bg-brand-amberSoft text-brand-amberDark ring-brand-amberDark/20 dark:bg-brand-amber/20 dark:text-brand-amber',
    teal: 'bg-brand-tealSoft text-brand-teal ring-brand-teal/20 dark:bg-brand-teal/20 dark:text-teal-300',
    gray: 'bg-brand-surfaceAlt text-brand-muted ring-brand-muted/20 dark:bg-white/10 dark:text-stone-300',
    red: 'bg-brand-redSoft text-brand-red ring-brand-red/20 dark:bg-brand-red/20 dark:text-red-300',
    blue: 'bg-brand-tealSoft text-brand-teal ring-brand-teal/20 dark:bg-brand-teal/20 dark:text-teal-300',
    muted: 'bg-brand-surfaceAlt text-brand-muted ring-brand-muted/20 dark:bg-white/10 dark:text-stone-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone] || tones.muted}`}>
      {children}
    </span>
  )
}

/* ── Stat ─────────────────────────────────────────────────────────────────
   A single headline metric. `live` gives it the teal pulse for real-time counts. */
export function Stat({ label, value, tone = 'ink', hint, live = false }) {
  const tones = {
    ink: 'text-brand-ink dark:text-brand-surface',
    green: 'text-brand-green dark:text-emerald-400',
    amber: 'text-brand-amberDark dark:text-brand-amber',
    teal: 'text-brand-teal dark:text-teal-300',
    red: 'text-brand-red dark:text-red-400',
    muted: 'text-brand-muted',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        {live && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-pulse-ring" aria-hidden="true" />}
        <div className="text-xs font-medium uppercase tracking-wide text-brand-muted">{label}</div>
      </div>
      <div className={`mt-2 font-display text-3xl font-bold tabular ${tones[tone] || tones.ink}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-brand-muted">{hint}</div>}
    </Card>
  )
}

/* ── Form field wrapper ─────────────────────────────────────────────────────
   Label ALWAYS above the input (never placeholder-only). Hint and error are
   mutually exclusive so the message area never stacks confusingly. */
export function Field({ label, hint, error, required, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-brand-ink dark:text-brand-surface">
          {label}
          {required && <span className="ml-0.5 text-brand-red" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-brand-muted">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-brand-red" role="alert">
          <Alert size={14} className="shrink-0" />{error}
        </p>
      )}
    </div>
  )
}

const controlBase =
  'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-brand-ink ' +
  'placeholder:text-brand-muted/60 transition-colors ' +
  'dark:bg-brand-darkSurface dark:text-brand-surface dark:border-brand-darkLine ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-amber/40'

export function Input({ className = '', invalid = false, ...props }) {
  const border = invalid ? 'border-brand-red focus:border-brand-red' : 'border-brand-line focus:border-brand-amber'
  return <input className={`${controlBase} ${border} ${className}`} aria-invalid={invalid || undefined} {...props} />
}

export function Textarea({ className = '', rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`w-full rounded-xl border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink placeholder:text-brand-muted/60 focus:border-brand-amber focus:outline-none focus:ring-2 focus:ring-brand-amber/40 ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${controlBase} border-brand-line focus:border-brand-amber pr-9 ${className}`} {...props}>
      {children}
    </select>
  )
}

/* ── Progress bar ─────────────────────────────────────────────────────────── */
export function ProgressBar({ pct, tone = 'amber', label }) {
  const clamped = Math.max(0, Math.min(100, pct || 0))
  const bar = { amber: 'bg-brand-amber', green: 'bg-brand-green', teal: 'bg-brand-teal' }[tone] || 'bg-brand-amber'
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-brand-surfaceAlt"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${bar} transition-[width] duration-500 ease-out`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

/* ── Avatar ─────────────────────────────────────────────────────────────────
   Deterministic warm hue from the name — recognizable per person, on-palette. */
export function Avatar({ name, size = 'md' }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' }
  let h = 0
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % 360
  // bias toward warm/earthy hues (skip cold blues) to stay on-palette
  const hue = 20 + (h % 60) + (h % 3) * 90 // spreads across amber/terracotta/olive/plum bands
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ${sizes[size]}`}
      style={{ backgroundColor: `hsl(${hue} 42% 42%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────────────────────
   Always icon + title + description + action — never a bare "No data". */
export function EmptyState({ icon, title, description, action }) {
  const Glyph = icon || Inbox
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-surfaceAlt text-brand-muted" aria-hidden="true">
        <Glyph size={26} />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-brand-ink dark:text-brand-surface">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-brand-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}

/**
 * Real scannable QR code rendered to a canvas via the `qrcode` library.
 * Supports light mode (dark modules on white) and dark mode (white modules
 * on dark) — toggled by the user so it works under any lighting condition.
 */
export function QRCode({ value, size = 200, id }) {
  const canvasRef = useRef(null)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: dark ? '#ffffff' : '#12100E',
        light: dark ? '#1a1a2e' : '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
  }, [value, size, dark])

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-xl p-2 shadow-e1 ring-1 ring-brand-line transition-colors"
        style={{ background: dark ? '#1a1a2e' : '#ffffff' }}
      >
        <canvas
          ref={canvasRef}
          id={id}
          width={size}
          height={size}
          role="img"
          aria-label="Attendee QR code"
          className="block rounded-lg"
        />
      </div>

      {/* Light / dark toggle — helps when phone screen glare washes out contrast */}
      <button
        type="button"
        onClick={() => setDark((d) => !d)}
        className="flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-medium text-brand-muted shadow-e1 transition-colors hover:bg-brand-surfaceAlt hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
        aria-label={dark ? 'Switch to light mode QR' : 'Switch to dark mode QR'}
      >
        {dark ? <Sun size={14} /> : <Moon size={14} />}
        {dark ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  )
}

/* ── Status badge (registration lifecycle) ────────────────────────────────── */
export function StatusBadge({ status }) {
  const map = {
    pending: ['amber', 'Pending'],
    approved: ['green', 'Approved'],
    rejected: ['red', 'Rejected'],
  }
  const [tone, label] = map[status] || ['gray', status]
  return <Badge tone={tone}>{label}</Badge>
}
