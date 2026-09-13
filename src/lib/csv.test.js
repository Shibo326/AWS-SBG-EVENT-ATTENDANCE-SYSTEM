// CSV round-trip + parse tests. parseCSV backs the bulk attendee import
// (Module 2); it must handle quoted cells, header aliases, and blank lines.

import { describe, it, expect } from 'vitest'
import { toCSV, parseCSV } from './csv.js'

describe('toCSV', () => {
  it('emits a header + rows and quotes cells with commas/quotes', () => {
    const out = toCSV([{ name: 'Dela Cruz, Juan', email: 'a@b.co' }], ['name', 'email'])
    expect(out).toContain('name,email')
    expect(out).toContain('"Dela Cruz, Juan",a@b.co')
  })
})

describe('parseCSV', () => {
  it('parses a simple roster into objects', () => {
    const rows = parseCSV('name,email\nJuan,a@b.co\nMaria,m@b.co')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ full_name: 'Juan', email: 'a@b.co' })
    expect(rows[1].full_name).toBe('Maria')
  })

  it('maps header aliases to canonical field names', () => {
    const rows = parseCSV('Full Name,E-mail,School,Section\nJuan,a@b.co,STI,BSIT 3-A')
    expect(rows[0]).toMatchObject({
      full_name: 'Juan', email: 'a@b.co', organization: 'STI', year_section: 'BSIT 3-A',
    })
  })

  it('honors quoted cells containing commas', () => {
    const rows = parseCSV('name,organization\n"Cruz, Juan","STI, Global City"')
    expect(rows[0].full_name).toBe('Cruz, Juan')
    expect(rows[0].organization).toBe('STI, Global City')
  })

  it('skips blank lines and tolerates CRLF', () => {
    const rows = parseCSV('name,email\r\nJuan,a@b.co\r\n\r\n')
    expect(rows).toHaveLength(1)
  })

  it('returns [] for empty input', () => {
    expect(parseCSV('')).toEqual([])
    expect(parseCSV(null)).toEqual([])
  })
})
