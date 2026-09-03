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
