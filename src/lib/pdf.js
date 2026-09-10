// PDF attendance-report export (PROJECT_PLAN Module 6).
//
// The report records the eligibility threshold and total countable hours in its
// header, so it stays interpretable later — a reader can see WHY each attendee
// was eligible or not, months after the event. Content is derived at generation
// time (derived-state rule §5.3): nothing here is stored.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  listAttendeesFrom,
  attendeeStatsFrom,
  normalizeSettings,
} from './db.js'
import {
  formatDuration,
  totalCountableMinutes,
  formatDateTime,
} from './time.js'

const eventTypeLabel = (t) =>
  ({ hackathon: 'Hackathon', seminar: 'Seminar', workshop: 'Workshop' }[t] || t || '—')

/**
 * Build and trigger download of the attendance PDF for an event snapshot.
 * @param {object} event  full event snapshot (meta, settings, attendees, scans)
 * @param {'all'|'eligible'|'not'} filter  which attendees to include
 * @param {number} now
 */
export function downloadAttendancePdf(event, filter = 'all', now = Date.now()) {
  const meta = event?.meta || {}
  const settings = normalizeSettings(event?.settings || {})
  const requiredMin = settings.min_minutes_required || 0
  const countableMin = totalCountableMinutes(settings.active_windows || [])

  const rows = listAttendeesFrom(event)
    .filter((a) => a.status === 'approved')
    .map((a) => ({ a, st: attendeeStatsFrom(event, a.id, now) }))
    .filter((r) => filter === 'all' || (filter === 'eligible' ? r.st.isEligible : !r.st.isEligible))
    .sort((x, y) => y.st.totalMinutes - x.st.totalMinutes)

  const eligibleCount = rows.filter((r) => r.st.isEligible).length

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 40

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Attendance & Certificate-Eligibility Report', margin, 54)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text('AWS Student Builder Group — STI College Global City', margin, 72)

  doc.setTextColor(20)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(meta.name || 'Event', margin, 100)

  // Interpretability block: type, venue, threshold, countable hours, generated.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(70)
  const info = [
    `Event type: ${eventTypeLabel(meta.event_type)}`,
    meta.venue ? `Venue: ${meta.venue}` : null,
    `Minimum required: ${formatDuration(requiredMin)}`,
    `Total countable hours: ${formatDuration(countableMin)}`,
    `Filter: ${filter === 'all' ? 'All approved' : filter === 'eligible' ? 'Eligible only' : 'Not eligible only'}`,
    `Eligible: ${eligibleCount} of ${rows.length}`,
    `Generated: ${formatDateTime(now)} (Asia/Manila)`,
  ].filter(Boolean)
  let y = 118
  for (const line of info) { doc.text(line, margin, y); y += 15 }

  // ── Table ───────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [['#', 'Name', 'Email', 'Org / Section', 'Time inside', 'Sessions', 'Eligible', 'Flags']],
    body: rows.map((r, i) => [
      String(i + 1),
      r.a.full_name || '',
      r.a.email || '',
      [r.a.organization, r.a.year_section].filter(Boolean).join(' · ') || '',
      formatDuration(r.st.totalMinutes),
      String(r.st.entryCount),
      r.st.isEligible ? 'Yes' : 'No',
      [r.st.capped ? 'capped' : null, r.st.isInside ? 'still inside' : null].filter(Boolean).join(', '),
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [26, 32, 44], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 248] },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { cellWidth: 60 },
      5: { cellWidth: 48, halign: 'center' },
      6: { cellWidth: 48, halign: 'center' },
    },
    didParseCell: (data) => {
      // Emphasize the eligibility column.
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = data.cell.raw === 'Yes' ? [22, 128, 61] : [120, 120, 120]
      }
    },
  })

  // ── Footer (page numbers) ────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(140)
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    const h = doc.internal.pageSize.getHeight()
    doc.text(
      `Derived from raw scan events at generation time · page ${p} of ${pageCount}`,
      pageW / 2, h - 20, { align: 'center' },
    )
  }

  const slug = (meta.name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  doc.save(`${slug}-attendance-report.pdf`)
  return rows.length
}
