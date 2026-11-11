import type { Category, CategoryTotal, Granularity, Trend } from '../../api/types'
import { categories, categoryLabel, formatKg, monthLabel, shortDate } from '../../lib/format'

// Pure helpers that shape API data for charts. Dates are ISO yyyy-mm-dd strings handled in UTC,
// so no browser timezone can shift a bucket by a day.

const DAY_MS = 86_400_000
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const addDays = (iso: string, n: number) => toIso(toMs(iso) + n * DAY_MS)

/** Inclusive length of [from, to] in days. */
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1

function mondayOf(iso: string) {
  const dow = new Date(toMs(iso)).getUTCDay() // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7))
}

export type Preset = '30d' | '12w' | '12m' | 'ytd'

export const presets: { value: Preset; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '12w', label: 'Last 12 weeks' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
]

export interface Range {
  from: string
  to: string
  granularity: Granularity
}

export function presetRange(preset: Preset, today: string): Range {
  switch (preset) {
    case '30d':
      return { from: addDays(today, -29), to: today, granularity: 'DAY' }
    case '12w':
      return { from: addDays(mondayOf(today), -77), to: today, granularity: 'WEEK' }
    case '12m': {
      const [y, m] = today.split('-').map(Number) as [number, number]
      const start = new Date(Date.UTC(y, m - 1 - 11, 1))
      return { from: toIso(start.getTime()), to: today, granularity: 'MONTH' }
    }
    case 'ytd': {
      const from = `${today.slice(0, 4)}-01-01`
      return { from, to: today, granularity: daysBetween(from, today) <= 62 ? 'DAY' : 'WEEK' }
    }
  }
}

/** The equally long period immediately before [from, to] — the same rule the API uses for /compare. */
export function previousRange(from: string, to: string) {
  const len = daysBetween(from, to)
  return { from: addDays(from, -len), to: addDays(from, -1) }
}

export function bucketLabel(start: string, g: Granularity) {
  return g === 'MONTH' ? monthLabel(start) : shortDate(start)
}

export type TrendRow = {
  key: string
  label: string
  start: string
  end: string
  total: number
  /** Total of the bucket at the same position in the previous period, when overlaid. */
  previous?: number
} & Record<Category, number>

/** Flattens buckets for the chart; the previous period is aligned by position (bucket 1 vs bucket 1). */
export function toTrendRows(trend: Trend, previous?: Trend): TrendRow[] {
  return trend.buckets.map((b, i) => {
    const row = {
      key: b.start,
      label: bucketLabel(b.start, trend.granularity),
      start: b.start,
      end: b.end,
      total: b.total,
      ...Object.fromEntries(categories.map((c) => [c, b.byCategory[c] ?? 0])),
    } as TrendRow
    const prev = previous?.buckets[i]
    if (prev) row.previous = prev.total
    return row
  })
}

export interface ShareRow {
  category: Category
  label: string
  kg: number
  /** Percentage of the total, 0 when nothing was logged. */
  share: number
}

/** Categories with their share of the total, largest first. */
export function shareRows(totals: CategoryTotal[]): ShareRow[] {
  const sum = totals.reduce((s, t) => s + t.kgCo2e, 0)
  return totals
    .map((t) => ({
      category: t.category,
      label: categoryLabel[t.category],
      kg: t.kgCo2e,
      share: sum > 0 ? (t.kgCo2e / sum) * 100 : 0,
    }))
    .sort((a, b) => b.kg - a.kg || categories.indexOf(a.category) - categories.indexOf(b.category))
}

/** One-sentence reading of a trend for screen readers and the chart caption. */
export function trendSentence(rows: TrendRow[]): string {
  const total = rows.reduce((s, r) => s + r.total, 0)
  if (total === 0) return 'Nothing logged in this period yet.'
  const peak = rows.reduce((a, b) => (b.total > a.total ? b : a))
  let s = `${formatKg(total)} kg CO2e in total; the highest point was ${peak.label} with ${formatKg(peak.total)} kg.`
  if (rows.some((r) => r.previous !== undefined)) {
    const prev = rows.reduce((sum, r) => sum + (r.previous ?? 0), 0)
    s += ` The previous period totalled ${formatKg(prev)} kg.`
  }
  return s
}
