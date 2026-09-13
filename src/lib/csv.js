// CSV helpers and a trigger for browser download.

function escapeCell(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** rows: array of objects; columns: array of keys in output order. */
export function toCSV(rows, columns) {
  const header = columns.map(escapeCell).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c])).join(',')).join('\n')
  return header + '\n' + body + '\n'
}

export function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── CSV parsing (for bulk attendee import, Module 2) ─────────────────────────

/**
 * Parse a single CSV line into fields, honoring double-quoted cells (which may
 * contain commas and escaped "" quotes). Handles the common cases a hand-made
 * or spreadsheet-exported roster produces.
 */
function parseLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } // escaped quote
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/**
 * Parse CSV text into an array of row objects keyed by the (lowercased,
 * underscored) header names. Blank lines are skipped. Returns [] for empty
 * input. Header aliases let common column names map to our fields:
 *   name/full name -> full_name, email, organization/org/school, year/section.
 */
export function parseCSV(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  const rawHeaders = parseLine(lines[0]).map((h) => h.toLowerCase().trim())
  const alias = (h) => {
    if (['full_name', 'name', 'full name', 'fullname'].includes(h)) return 'full_name'
    if (['email', 'e-mail', 'email address'].includes(h)) return 'email'
    if (['organization', 'org', 'school', 'organisation'].includes(h)) return 'organization'
    if (['year_section', 'year & section', 'year and section', 'section', 'year'].includes(h)) return 'year_section'
    return h.replace(/\s+/g, '_')
  }
  const headers = rawHeaders.map(alias)

  return lines.slice(1).map((line) => {
    const cells = parseLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })
}
