// Icon set — stroke-based, 24x24, inherits color via `currentColor` and size
// via width/height props (default 20). Geometry follows the Feather/Lucide
// convention (2px stroke, round caps/joins) so icons read as a deliberate,
// consistent family rather than mixed clip-art. Import only what a screen uses.
//
// Usage:  <Search /> · <Search className="text-brand-muted" /> · <Check size={16} />

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

// Merge default size with an optional `size` prop and pass through the rest.
function svg(size, props) {
  const { width, height, ...rest } = props
  const s = size ?? 20
  return { ...base, width: width ?? s, height: height ?? s, ...rest }
}

export function Search({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function Check({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function X({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function Alert({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

export function Clock({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

export function Lock({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function MapPin({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function ArrowRight({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="14 6 20 12 14 18" />
    </svg>
  )
}

export function ArrowLeft({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="20" y1="12" x2="4" y2="12" />
      <polyline points="10 6 4 12 10 18" />
    </svg>
  )
}

export function ArrowDown({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="6 14 12 20 18 14" />
    </svg>
  )
}

export function ArrowUp({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="18 10 12 4 6 10" />
    </svg>
  )
}

export function ArrowUpRight({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="8 7 17 7 17 16" />
    </svg>
  )
}

export function Download({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function Link2({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export function Camera({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export function CameraOff({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M7 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h15" />
      <path d="M9.5 4h5l2 3H21a2 2 0 0 1 2 2v9" />
      <path d="M14.12 10.12a3 3 0 1 1-4.24 4.24" />
    </svg>
  )
}

export function Ticket({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M4 8a2 2 0 0 0-2 2v1a2 2 0 1 1 0 4v1a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1a2 2 0 1 1 0-4v-1a2 2 0 0 0-2-2Z" />
      <line x1="14" y1="8" x2="14" y2="18" strokeDasharray="1 3" />
    </svg>
  )
}

export function GradCap({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M22 9 12 5 2 9l10 4 10-4Z" />
      <path d="M6 11v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </svg>
  )
}

export function Grid({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function FileText({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  )
}

export function Settings({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function Inbox({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  )
}

export function Sun({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

export function Moon({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}

export function Plus({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function Dice({ size, ...p }) {
  return (
    <svg {...svg(size, p)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}
