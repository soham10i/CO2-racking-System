import type { TrendBucket } from '../../api/types'

export interface HeatCell {
  date: string
  kg: number
  level: 0 | 1 | 2 | 3 | 4
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Upper bounds of levels 1–3, from the quartiles of the days that have entries, so the shades spread over the
 * user's own range. Level 0 is "nothing logged", never a quartile.
 */
export function thresholds(values: number[]): [number, number, number] {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b)
  if (!v.length) return [0, 0, 0]
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))]!
  return [q(0.25), q(0.5), q(0.75)]
}

export function levelOf(kg: number, t: [number, number, number]): HeatCell['level'] {
  if (kg <= 0) return 0
  if (kg <= t[0]) return 1
  if (kg <= t[1]) return 2
  if (kg <= t[2]) return 3
  return 4
}

/** Weeks (Monday first) as columns of seven cells; days outside the range are null. */
export function weeks(buckets: TrendBucket[], from: string, to: string): { weeks: (HeatCell | null)[][]; t: [number, number, number] } {
  const byDate = new Map(buckets.map((b) => [b.start, b.total]))
  const t = thresholds(buckets.map((b) => b.total))
  const first = new Date(`${from}T00:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  let day = addDays(from, -offset)
  const out: (HeatCell | null)[][] = []
  while (day <= to) {
    const col: (HeatCell | null)[] = []
    for (let i = 0; i < 7; i++, day = addDays(day, 1)) {
      if (day < from || day > to) col.push(null)
      else {
        const kg = byDate.get(day) ?? 0
        col.push({ date: day, kg, level: levelOf(kg, t) })
      }
    }
    out.push(col)
  }
  return { weeks: out, t }
}
