// PDF attendance report generator (PROJECT_PLAN Module 6).
// Uses jsPDF only — no html2canvas — so the output is crisp vector text, small,
// and deterministic. Draws a header block + a paginated attendee table by hand
// (no autotable plugin needed) to keep the dependency surface minimal.

import { jsPDF } from 'jspdf'
import { formatDuration, formatDate, totalCountableMinutes } from './time.js'

const BRAND_INK = '#12100E'
const BRAND_AMBER = '#FF9900'
const MUTED = '#6B7280'
const LINE = '#E5E7EB'

/**
 * @param {object} args
 * @param {object} args.meta      event meta { name, event_type, venue, created_at }
 * @param {object} args.settings  event settings { min_minutes_required, active_windows }
 * @param {string} args.typeLabel human label for event type
 * @param {Array}  args.rows      [{ name, email, year_section, minutes, eligible }]
 * @param {number} args.registered
 * @param {number} args.eligibleCount
 */
export function buildAttendancePDF({ meta, settings, typeLabel, rows, registered, eligibleCount }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = margin

  // ── header band ─────────────────────────────────────────────────────────
  doc.setFillColor(BRAND_INK)
  doc.rect(0, 0, pageW, 90, 'F')
  doc.setFillColor(BRAND_AMBER)
  doc.roundedRect(margin, 28, 34, 34, 6, 6, 'F')
  doc.setTextColor(BRAND_INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('A', margin + 17, 51, { align: 'center' })

  doc.setTextColor('#FFFFFF')
  doc.setFontSize(16)
  doc.text(meta.name, margin + 48, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#C9CDD4')
  doc.text(`${typeLabel} · ${meta.venue || 'No venue'}`, margin + 48, 62)

  y = 118

  // ── summary line ────────────────────────────────────────────────────────
  const countable = totalCountableMinutes(settings.active_windows)
  doc.setTextColor(BRAND_INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Attendance & Certificate Eligibility Report', margin, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(MUTED)
  const summary = [
    `Generated: ${formatDate(Date.now())}`,
    `Minimum required: ${formatDuration(settings.min_minutes_required)}`,
    `Countable hours: ${formatDuration(countable)}`,
    `Registered: ${registered}`,
    `Eligible: ${eligibleCount}`,
  ].join('    ·    ')
  doc.text(summary, margin, y)
  y += 22

  // ── table header ──────────────────────────────────────────────────────────
  const cols = [
    { key: 'name', label: 'Name', x: margin, w: 150 },
    { key: 'year_section', label: 'Year/Section', x: margin + 150, w: 90 },
    { key: 'minutes', label: 'Time inside', x: margin + 240, w: 80 },
    { key: 'eligible', label: 'Eligible', x: margin + 320, w: 70 },
    { key: 'email', label: 'Email', x: margin + 390, w: pageW - margin - (margin + 390) },
  ]

  const drawHeader = () => {
    doc.setDrawColor(LINE)
    doc.setFillColor('#F7F8FA')
    doc.rect(margin, y, pageW - margin * 2, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(BRAND_INK)
    cols.forEach((c) => doc.text(c.label, c.x + 4, y + 13))
    y += 20
  }
  drawHeader()

  // ── rows ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  rows.forEach((r, i) => {
    if (y + 18 > pageH - margin) {
      doc.addPage()
      y = margin
      drawHeader()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
    }
    if (i % 2 === 1) {
      doc.setFillColor('#FBFBFC')
      doc.rect(margin, y, pageW - margin * 2, 18, 'F')
    }
    doc.setTextColor(BRAND_INK)
    doc.text(clip(doc, r.name, cols[0].w - 8), cols[0].x + 4, y + 12)
    doc.setTextColor(MUTED)
    doc.text(r.year_section || '—', cols[1].x + 4, y + 12)
    doc.setTextColor(BRAND_INK)
    doc.text(formatDuration(r.minutes), cols[2].x + 4, y + 12)
    if (r.eligible) {
      doc.setTextColor('#1E8E5A')
      doc.text('Yes', cols[3].x + 4, y + 12)
    } else {
      doc.setTextColor(MUTED)
      doc.text('No', cols[3].x + 4, y + 12)
    }
    doc.setTextColor(MUTED)
    doc.text(clip(doc, r.email, cols[4].w - 8), cols[4].x + 4, y + 12)
    y += 18
  })

  // ── footer on every page ──────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED)
    doc.text('AWS Student Builder Group · STI College Global City', margin, pageH - 20)
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 20, { align: 'right' })
  }

  return doc
}

// Truncate text with an ellipsis to fit a given pixel width.
function clip(doc, text, maxW) {
  const s = String(text ?? '')
  if (doc.getTextWidth(s) <= maxW) return s
  let out = s
  while (out.length > 1 && doc.getTextWidth(out + '…') > maxW) out = out.slice(0, -1)
  return out + '…'
}
