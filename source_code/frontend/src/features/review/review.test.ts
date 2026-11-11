import { describe, expect, it } from 'vitest'
import type { Comparison, Trend } from '../../api/types'
import { stories, yearSpan, yearStats } from './review'

const zero = { TRANSPORT: 0, ENERGY: 0, DIET: 0, SHOPPING: 0, WASTE: 0 }
const totals = (total: number, transport = 0): Comparison => ({
  current: { from: '', to: '', total, byCategory: [{ category: 'TRANSPORT', kgCo2e: transport }, { category: 'DIET', kgCo2e: total - transport }] },
  previous: { from: '', to: '', total: 0, byCategory: [] },
  categories: [],
})

describe('year in review', () => {
  it('spans the year to today and lines up the same days a year earlier', () => {
    expect(yearSpan(2026, '2026-10-30')).toMatchObject({ from: '2026-01-01', to: '2026-10-30', previousTo: '2025-10-30', complete: false })
    expect(yearSpan(2025, '2026-10-30')).toMatchObject({ to: '2025-12-31', complete: true })
    expect(yearSpan(2028, '2028-02-29').previousTo).toBe('2027-02-28')
  })

  it('builds stories from API totals', () => {
    const trend: Trend = {
      from: '2026-01-01',
      to: '2026-03-31',
      granularity: 'MONTH',
      buckets: [
        { start: '2026-01-01', end: '2026-01-31', total: 60, byCategory: zero },
        { start: '2026-02-01', end: '2026-02-28', total: 0, byCategory: zero },
        { start: '2026-03-01', end: '2026-03-31', total: 40, byCategory: zero },
      ],
    }
    const s = yearStats(trend, totals(100, 75), totals(200))
    expect(s).toMatchObject({ monthsLogged: 2, top: { category: 'TRANSPORT', share: 75 }, changePct: -50 })
    expect(s.lowest?.month).toBe('2026-03-01')
    const list = stories(s, yearSpan(2026, '2026-10-30'), 0)
    expect(list.map((x) => x.key)).toEqual(['total', 'top', 'months', 'change'])
    expect(list[3]!.headline).toBe('-50%')
  })

  it('leaves the month in progress out of the lightest month', () => {
    const trend: Trend = {
      from: '2026-09-01',
      to: '2026-10-30',
      granularity: 'MONTH',
      buckets: [
        { start: '2026-09-01', end: '2026-09-30', total: 300, byCategory: zero },
        { start: '2026-10-01', end: '2026-10-30', total: 50, byCategory: zero },
      ],
    }
    const s = yearStats(trend, totals(350, 0), totals(0), false)
    expect(s.monthsLogged).toBe(2)
    expect(s.lowest).toBeUndefined()
    expect(stories(s, yearSpan(2026, '2026-10-30'), 1).map((x) => x.key)).toEqual(['total', 'top', 'change', 'commitments'])
  })
})
