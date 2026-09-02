import { Button } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-surface p-6">
      <div className="text-center animate-rise">
        <div className="font-display text-7xl font-bold tracking-tight text-brand-ink">404</div>
        <p className="mt-3 text-brand-muted">This page doesn&rsquo;t exist or the link has expired.</p>
        <Button className="mt-6" to="/admin">← Back to events</Button>
      </div>
    </div>
  )
}
