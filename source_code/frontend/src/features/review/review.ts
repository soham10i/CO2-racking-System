import type { Category, Comparison, Trend } from '../../api/types'
import { categoryLabel, formatChange, formatKg } from '../../lib/format'

export interface YearSpan {
  year: number
  from: string
  to: string
  /** The same calendar days one year earlier, for a like-for-like change. */
  previousFrom: string
  previousTo: string
  complete: boolean
}

/** 1 Jan to 31 Dec, or to today for the year in progress. */
export function yearSpan(year: number, today: string): YearSpan {
  const end = `${year}-12-31`
  const to = end < today ? end : today
  return {
    year,
    from: `${year}-01-01`,
    to,
    previousFrom: `${year - 1}-01-01`,
    // 29 Feb has no twin in a common year; 28 Feb stands in.
    previousTo: `${year - 1}${to.slice(4) === '-02-29' ? '-02-28' : to.slice(4)}`,
    complete: to === end,
  }
}

export interface Story {
  key: string
  eyebrow: string
  headline: string
  detail: string
}

export interface YearStats {
  total: number
  monthsLogged: number
  top?: { category: Category; kg: number; share: number }
  highest?: { month: string; kg: number }
  lowest?: { month: string; kg: number }
  changePct?: number
  previousTotal: number
}

/**
 * Picks the facts from API totals; nothing here estimates emissions. While the year is still running, the
 * current month is left out of the lightest/heaviest pick, since a half-finished month always looks light.
 */
export function yearStats(trend: Trend, current: Comparison, previous: Comparison, complete = true): YearStats {
  const total = current.current.total
  const logged = trend.buckets.filter((b) => b.total > 0)
  const whole = complete ? logged : logged.filter((b) => b.start !== trend.buckets[trend.buckets.length - 1]?.start)
  const byKg = [...whole].sort((a, b) => b.total - a.total)
  const topCat = [...current.current.byCategory].sort((a, b) => b.kgCo2e - a.kgCo2e)[0]
  const previousTotal = previous.current.total
  return {
    total,
    monthsLogged: logged.length,
    top: topCat && topCat.kgCo2e > 0 ? { category: topCat.category, kg: topCat.kgCo2e, share: (topCat.kgCo2e / total) * 100 } : undefined,
    highest: byKg[0] && { month: byKg[0].start, kg: byKg[0].total },
    lowest: byKg.length > 1 ? { month: byKg[byKg.length - 1]!.start, kg: byKg[byKg.length - 1]!.total } : undefined,
    changePct: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : undefined,
    previousTotal,
  }
}

const monthName = (iso: string) => new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

export function stories(s: YearStats, span: YearSpan, commitments: number): Story[] {
  const out: Story[] = [
    {
      key: 'total',
      eyebrow: span.complete ? `Your ${span.year}` : `${span.year} so far`,
      headline: `${formatKg(s.total)} kg CO2e`,
      detail: `Logged across ${s.monthsLogged} ${s.monthsLogged === 1 ? 'month' : 'months'}.`,
    },
  ]
  if (s.top) {
    out.push({
      key: 'top',
      eyebrow: 'Biggest source',
      headline: categoryLabel[s.top.category],
      detail: `${Math.round(s.top.share)}% of your total, ${formatKg(s.top.kg)} kg.`,
    })
  }
  if (s.lowest && s.highest) {
    out.push({
      key: 'months',
      eyebrow: 'Lightest month',
      headline: monthName(s.lowest.month),
      detail: `${formatKg(s.lowest.kg)} kg, against ${formatKg(s.highest.kg)} kg in ${monthName(s.highest.month)}, your heaviest.`,
    })
  }
  out.push(
    s.changePct === undefined
      ? {
          key: 'change',
          eyebrow: `Versus ${span.year - 1}`,
          headline: 'A first year',
          detail: `Nothing was logged over the same days of ${span.year - 1}, so this year is your starting line.`,
        }
      : {
          key: 'change',
          eyebrow: `Versus the same days of ${span.year - 1}`,
          headline: formatChange(s.changePct),
          detail:
            s.changePct <= 0
              ? `Down from ${formatKg(s.previousTotal)} kg. Keep it going.`
              : `Up from ${formatKg(s.previousTotal)} kg. Your suggestions on Insights show where to start.`,
        },
  )
  if (commitments > 0) {
    out.push({
      key: 'commitments',
      eyebrow: 'Changes you took on',
      headline: `${commitments} ${commitments === 1 ? 'commitment' : 'commitments'}`,
      detail: 'Tracked on Insights against what you actually log.',
    })
  }
  return out
}
