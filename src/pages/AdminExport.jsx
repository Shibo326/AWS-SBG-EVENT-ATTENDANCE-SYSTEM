import { useState } from 'react'
import { useParams } from 'react-router-dom'
import AdminLayout, { PageHeader } from '../components/AdminLayout.jsx'
import { Card, Button, Badge, Avatar, EmptyState } from '../components/ui.jsx'
import { listAttendeesFrom, attendeeStatsFrom, certflowRowsFrom, analyticalRowsFrom } from '../lib/db.js'
import { useEvent } from '../lib/dbHooks.js'
import { formatDuration } from '../lib/time.js'
import { toCSV, downloadCSV } from '../lib/csv.js'
import { downloadAttendancePdf } from '../lib/pdf.js'
import { toast } from '../components/Toast.jsx'
import { Alert, GradCap, Grid, FileText, ArrowRight, ArrowUpRight } from '../components/icons.jsx'

// Deployed CertFlow app (the group's standalone bulk certificate generator + emailer).
// The handoff is a CSV: export the eligible list here, then open CertFlow to upload it.
const CERTFLOW_URL = 'https://awsc-certificate-automation.streamlit.app'

export default function AdminExport() {
  const { eventId } = useParams()
  const { event, loading } = useEvent(eventId)
  const [filter, setFilter] = useState('all')

  if (loading) {
    return (
      <AdminLayout>
        <div className="h-8 w-52 animate-pulse rounded bg-brand-surfaceAlt" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-brand-surfaceAlt/60" />
      </AdminLayout>
    )
  }
  if (!event) return <AdminLayout><EmptyState title="Event not found" action={<Button to="/admin">Back</Button>} /></AdminLayout>

  const rows = listAttendeesFrom(event)
    .filter((a) => a.status === 'approved')
    .map((a) => ({ a, st: attendeeStatsFrom(event, a.id) }))
    .sort((x, y) => y.st.totalMinutes - x.st.totalMinutes)

  const shown = rows.filter((r) => filter === 'all' || (filter === 'eligible' ? r.st.isEligible : !r.st.isEligible))
  const eligibleCount = rows.filter((r) => r.st.isEligible).length
  const flagged = rows.filter((r) => r.st.capped || (r.st.isInside)).length

  const slug = (event.meta?.name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const exportCertflow = () => {
    const data = certflowRowsFrom(event)
    downloadCSV(`${slug}-certflow.csv`, toCSV(data, ['name', 'email']))
    toast(`Exported ${data.length} eligible attendee${data.length !== 1 ? 's' : ''} for CertFlow`, 'success')
  }
  const exportAnalytical = () => {
    const data = analyticalRowsFrom(event)
    downloadCSV(`${slug}-attendance.csv`, toCSV(data, ['name', 'email', 'organization', 'year_section', 'total_minutes', 'sessions', 'eligible', 'review']))
    toast('Analytical CSV downloaded', 'success')
  }
  const exportPdf = () => {
    // Respects the current filter (all / eligible / not) so the printed report
    // matches what the admin is looking at.
    const pdfFilter = filter === 'not' ? 'not' : filter
    const n = downloadAttendancePdf(event, pdfFilter)
    toast(`PDF report downloaded (${n} attendee${n !== 1 ? 's' : ''})`, 'success')
  }

  return (
    <AdminLayout>
      <PageHeader title="Eligibility & export" subtitle="Final attendance results and downloadable reports." />

      {flagged > 0 && (
        <Card className="mb-6 flex items-start gap-3 border-brand-amberDark/30 bg-brand-amberSoft p-4">
          <Alert size={18} className="mt-0.5 shrink-0 text-brand-amberDark" />
          <p className="text-sm leading-relaxed text-brand-amberWarn">
            <strong className="text-brand-amberDark">{flagged}</strong> attendee{flagged !== 1 ? 's' : ''} still inside or with a capped session. Review these before exporting — someone still &ldquo;inside&rdquo; hasn&rsquo;t scanned out yet.
          </p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card interactive className="flex items-center gap-4 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-amberSoft text-brand-amberDark"><GradCap size={24} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-brand-ink">CertFlow-ready CSV</h3>
            <p className="text-xs text-brand-muted">{eligibleCount} eligible · name,email only · drops into CertFlow</p>
          </div>
          <Button onClick={exportCertflow} disabled={eligibleCount === 0}>Download</Button>
        </Card>
        <Card interactive className="flex items-center gap-4 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-surfaceAlt text-brand-muted"><Grid size={24} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-brand-ink">Analytical CSV</h3>
            <p className="text-xs text-brand-muted">All approved · times, sessions, flags</p>
          </div>
          <Button variant="outline" onClick={exportAnalytical}>Download</Button>
        </Card>
        <Card interactive className="flex items-center gap-4 p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-surfaceAlt text-brand-muted"><FileText size={24} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-brand-ink">PDF report</h3>
            <p className="text-xs text-brand-muted">Header + table · records threshold &amp; countable hours · matches the current filter</p>
          </div>
          <Button variant="outline" onClick={exportPdf} disabled={rows.length === 0}>Download</Button>
        </Card>
      </div>

      {/* CertFlow handoff — download the eligible CSV above, then jump straight to
          CertFlow to upload it and send the certificates. Two clear steps. */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 bg-brand-ink p-5 text-white">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-amber text-brand-ink"><GradCap size={24} /></div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold">Send the certificates with CertFlow</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-white/70">
              <span className="font-medium text-white">1.</span> Download the CertFlow-ready CSV above.
              <ArrowRight size={14} className="text-white/40" />
              <span className="font-medium text-white">2.</span> Open CertFlow, upload it, and email everyone their certificate.
            </p>
          </div>
          <Button
            as="a"
            href={CERTFLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-visible:ring-offset-brand-ink"
          >
            Open CertFlow<ArrowUpRight size={16} />
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-brand-line p-4">
          <h2 className="font-display font-semibold text-brand-ink">Results</h2>
          <div className="flex gap-2">
            {['all', 'eligible', 'not'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${filter === f ? 'bg-brand-ink text-white shadow-e1' : 'border border-brand-line bg-white text-brand-muted hover:bg-brand-surfaceAlt hover:text-brand-ink'}`}>
                {f === 'all' ? 'All' : f === 'eligible' ? 'Eligible' : 'Not eligible'}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-brand-muted">No attendees in this view.</div>
        ) : (
          <ul className="divide-y divide-brand-line">
            {shown.map(({ a, st }) => (
              <li key={a.id} className="flex items-center gap-3 p-4">
                <Avatar name={a.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-brand-ink">{a.full_name}</p>
                  <p className="truncate text-xs text-brand-muted">{a.email}{a.year_section ? ` · ${a.year_section}` : ''}</p>
                </div>
                {st.capped && <Badge tone="amber">Capped</Badge>}
                {st.isInside && <Badge tone="teal">Still inside</Badge>}
                <span className="w-20 text-right text-sm font-medium tabular text-brand-ink">{formatDuration(st.totalMinutes)}</span>
                <span className="w-24 text-right">{st.isEligible ? <Badge tone="green">Eligible</Badge> : <Badge tone="gray">Not yet</Badge>}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminLayout>
  )
}
