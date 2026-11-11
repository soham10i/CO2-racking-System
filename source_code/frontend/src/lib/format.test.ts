import { describe, expect, it } from 'vitest'
import { formatKg, unitLabel } from './format'

describe('format', () => {
  it('formats footprints with one decimal and keeps precision for tiny values', () => {
    expect(formatKg(2.04)).toBe('2.0')
    expect(formatKg(1234.56)).toBe('1,234.6')
    expect(formatKg(0)).toBe('0.0')
    expect(formatKg(0.012)).toBe('0.012')
  })

  it('maps unit codes to display units', () => {
    expect(unitLabel('KM')).toBe('km')
    expect(unitLabel('KWH')).toBe('kWh')
    expect(unitLabel('LITRE')).toBe('L')
  })
})
