import { describe, expect, it } from 'vitest'
import type { Trend } from '../../api/types'
import { addDays, daysBetween, presetRange, previousRange, shareRows, toTrendRows, trendSentence } from './series'

const zero = { TRANSPORT: 0, ENERGY: 0, DIET: 0, SHOPPING: 0, WASTE: 0 }
const trend = (starts: string[], totals: number[]): Trend => ({
  from: starts[0]!,
  to: starts[starts.length - 1]!,
  granularity: 'DAY',
  buckets: starts.map((s, i) => ({ start: s, end: s, total: totals[i]!, byCategory: { ...zero, TRANSPORT: totals[i]! } })),
})

describe('date ranges', () => {
  it('does date math in UTC across month and leap boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(31)
  })

  it('builds presets that match the API bucket rules', () => {
    expect(presetRange('30d', '2026-03-31')).toEqual({ from: '2026-03-02', to: '2026-03-31', granularity: 'DAY' })
    // 2026-03-04 is a Wednesday; 12 ISO weeks start on a Monday.
    expect(presetRange('12w', '2026-03-04')).toEqual({ from: '2025-12-15', to: '2026-03-04', granularity: 'WEEK' })
    expect(presetRange('12m', '2026-03-04').from).toBe('2025-04-01')
    expect(presetRange('ytd', '2026-01-20').granularity).toBe('DAY')
    expect(presetRange('ytd', '2026-10-30').granularity).toBe('WEEK')
  })

  it('takes the equally long period immediately before', () => {
    expect(previousRange('2026-03-08', '2026-03-14')).toEqual({ from: '2026-03-01', to: '2026-03-07' })
  })
})

describe('chart rows', () => {
  it('aligns the previous period by position and tolerates a shorter one', () => {
    const rows = toTrendRows(trend(['2026-03-08', '2026-03-09'], [2, 0]), trend(['2026-03-06'], [5]))
    expect(rows.map((r) => [r.total, r.previous])).toEqual([[2, 5], [0, undefined]])
    expect(rows[0]!.TRANSPORT).toBe(2)
    expect(trendSentence(rows)).toContain('previous period totalled 5.0 kg')
  })

  it('computes shares that sum to 100 and never divide by zero', () => {
    const rows = shareRows([
      { category: 'ENERGY', kgCo2e: 30 },
      { category: 'TRANSPORT', kgCo2e: 10 },
      { category: 'DIET', kgCo2e: 0 },
    ])
    expect(rows[0]!.category).toBe('ENERGY')
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100)
    expect(shareRows([{ category: 'DIET', kgCo2e: 0 }])[0]!.share).toBe(0)
  })

  it('says so when nothing is logged', () => {
    expect(trendSentence(toTrendRows(trend(['2026-03-08'], [0])))).toBe('Nothing logged in this period yet.')
  })
})
