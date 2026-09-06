import { Link, useParams, useLocation } from 'react-router-dom'
import { getEvent, eventTypeInfo } from '../lib/store.js'
import { useStore, useTheme } from '../lib/hooks.js'
import { Grid, FileText, Settings, GradCap, Camera, ArrowLeft, ArrowUpRight, Sun, Moon } from './icons.jsx'

const NAV = [
  { key: '', label: 'Dashboard', icon: Grid },
  { key: 'registrations', label: 'Registrations', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'export', label: 'Eligibility & Export', icon: GradCap },
]

// Standalone links that appear below the event nav (not event-scoped paths)
const NAV_STANDALONE = [
  { href: '/scan', label: 'Gate Scanner', icon: Camera },
]

export default function AdminLayout({ children }) {
  useStore()
  const [isDark, toggleTheme] = useTheme()
  const { eventId } = useParams()
  const location = useLocation()
  const event = eventId ? getEvent(eventId) : null
  const meta = event?.meta

  const currentSeg = location.pathname.split('/').slice(4).join('/') || ''

  return (
    <div className="min-h-screen bg-brand-surface dark:bg-brand-darkSurface">
      {/* Top bar — warm ink, brand mark left, "all events" escape hatch right */}
      <header className="sticky top-0 z-30 border-b border-black/10 bg-brand-ink text-white shadow-e2">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/admin" className="flex items-center gap-2.5 font-display font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-amber text-brand-ink on-accent shadow-e1">A</span>
            <span className="hidden tracking-tight sm:inline">SBG Attendance</span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {eventId && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft size={16} />All events
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Active-event context banner — persistent, so an admin never acts on the
          wrong event while several run concurrently (PROJECT_PLAN Module 0 / R15). */}
      {meta && (
        <div className="border-b border-brand-line bg-brand-amberSoft">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-amberDark">
              <span className="h-2 w-2 rounded-full bg-brand-amber animate-pulse-ring" aria-hidden="true" />
              Now managing
            </span>
            <span className="font-display font-semibold text-brand-ink">{meta.name}</span>
            <span className="text-sm text-brand-muted">· {eventTypeInfo(meta.event_type).label}</span>
            {meta.venue && <span className="hidden text-sm text-brand-muted sm:inline">· {meta.venue}</span>}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar (desktop, only inside an event) */}
        {eventId && (
          <aside className="hidden w-60 shrink-0 px-3 py-6 md:block">
            <nav className="space-y-1">
              {NAV.map((item) => {
                const active = currentSeg === item.key
                const Icon = item.icon
                return (
                  <Link
                    key={item.key}
                    to={`/admin/event/${eventId}${item.key ? '/' + item.key : ''}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white text-brand-ink shadow-e1 ring-1 ring-brand-line dark:bg-brand-darkCard dark:text-brand-surface dark:ring-brand-darkLine'
                        : 'text-brand-muted hover:bg-brand-surfaceAlt hover:text-brand-ink dark:hover:bg-brand-navy dark:hover:text-brand-surface'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Divider + standalone tools */}
            <div className="mt-4 border-t border-brand-line pt-4">
              {NAV_STANDALONE.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-brand-muted transition-colors hover:bg-brand-surfaceAlt hover:text-brand-ink dark:hover:bg-brand-navy dark:hover:text-brand-surface"
                  >
                    <Icon size={18} className="shrink-0" />
                    {item.label}
                    <ArrowUpRight size={13} className="ml-auto text-brand-muted/60" />
                  </a>
                )
              })}
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          {/* Mobile nav — horizontal pills */}
          {eventId && (
            <nav className="mb-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {NAV.map((item) => {
                const active = currentSeg === item.key
                return (
                  <Link
                    key={item.key}
                    to={`/admin/event/${eventId}${item.key ? '/' + item.key : ''}`}
                    aria-current={active ? 'page' : undefined}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-ink text-white shadow-e1 dark:bg-brand-amber dark:text-brand-ink'
                        : 'border border-brand-line bg-white text-brand-muted dark:bg-brand-darkCard dark:border-brand-darkLine'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              {/* Gate Scanner pill — opens in new tab */}
              {NAV_STANDALONE.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-sm font-medium text-brand-muted transition-colors hover:bg-brand-surfaceAlt dark:bg-brand-darkCard dark:border-brand-darkLine"
                  >
                    <Icon size={15} />{item.label}
                  </a>
                )
              })}
            </nav>
          )}
          <div className="animate-rise">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-brand-ink dark:text-brand-surface">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-brand-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
