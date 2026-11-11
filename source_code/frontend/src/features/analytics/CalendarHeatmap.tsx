import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrend } from './hooks'
import { weeks, type HeatCell } from './heatmap'
import { ChartCard } from '../../components/charts/ChartCard'
import { Loading, Skeleton } from '../../components/ui'
import { formatKg, localToday, monthLabel, shortDate } from '../../lib/format'

const CELL = 12
const GAP = 3
const STEP = CELL + GAP
const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', '']

const minusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** A year of daily totals, one sequential lime ramp; click a day to open it in the log. */
export function CalendarHeatmap() {
  const to = localToday()
  const from = minusDays(to, 364)
  const trend = useTrend({ from, to, granularity: 'DAY' })
  const navigate = useNavigate()
  const [focus, setFocus] = useState<HeatCell | null>(null)

  const grid = useMemo(() => (trend.data ? weeks(trend.data.buckets, from, to) : null), [trend.data, from, to])
  const logged = trend.data?.buckets.filter((b) => b.total > 0) ?? []
  const total = logged.reduce((s, b) => s + b.total, 0)

  const months = useMemo(() => {
    const m = new Map<string, { kg: number; days: number }>()
    for (const b of trend.data?.buckets ?? []) {
      const key = b.start.slice(0, 7)
      const row = m.get(key) ?? { kg: 0, days: 0 }
      row.kg += b.total
      if (b.total > 0) row.days++
      m.set(key, row)
    }
    return [...m.entries()]
  }, [trend.data])

  const open = (c: HeatCell) => navigate('/log', { state: { date: c.date } })

  const legend = grid
    ? [
        { level: 0, text: 'none' },
        { level: 1, text: `≤ ${formatKg(grid.t[0])}` },
        { level: 2, text: `≤ ${formatKg(grid.t[1])}` },
        { level: 3, text: `≤ ${formatKg(grid.t[2])}` },
        { level: 4, text: `> ${formatKg(grid.t[2])}` },
      ]
    : []

  return (
    <ChartCard
      figure
      title="Your year, day by day"
      summary={
        trend.data
          ? `${logged.length} of 365 days logged, ${formatKg(total)} kg CO2e in total. Darker days emitted more.`
          : 'Daily totals for the last 365 days.'
      }
      table={{
        columns: ['Month', 'kg CO2e', 'Days logged'],
        rows: months.map(([m, r]) => [monthLabel(`${m}-01`), formatKg(r.kg), r.days]),
      }}
    >
      {!grid ? (
        <Loading label="Loading calendar">
          <Skeleton className="h-[128px] w-full rounded-2xl" />
        </Loading>
      ) : (
        <div className="space-y-3">
          {/* Focusable so keyboard users can scroll the year sideways on narrow screens. */}
          <div className="overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Calendar, scrolls sideways">
            <svg
              width={30 + grid.weeks.length * STEP}
              height={18 + 7 * STEP}
              role="img"
              aria-label="Calendar of daily emissions; use the table view for exact values"
              className="block"
            >
              {grid.weeks.map((col, x) => {
                const firstOfMonth = col.find((c) => c && c.date.endsWith('-01'))
                return firstOfMonth ? (
                  <text key={`m${x}`} x={30 + x * STEP} y={10} className="fill-[var(--muted)] text-[10px]">
                    {monthLabel(firstOfMonth.date).split(' ')[0]}
                  </text>
                ) : null
              })}
              {DAYS.map((d, y) =>
                d ? (
                  <text key={d} x={0} y={18 + y * STEP + CELL - 2} className="fill-[var(--muted)] text-[10px]">
                    {d}
                  </text>
                ) : null,
              )}
              {grid.weeks.map((col, x) =>
                col.map((c, y) =>
                  c ? (
                    <rect
                      key={c.date}
                      x={30 + x * STEP}
                      y={18 + y * STEP}
                      width={CELL}
                      height={CELL}
                      rx={2.5}
                      className={`heat-${c.level} cursor-pointer transition-opacity ${focus?.date === c.date ? 'stroke-[var(--ink)]' : ''}`}
                      strokeWidth={focus?.date === c.date ? 2 : 0}
                      onMouseEnter={() => setFocus(c)}
                      onMouseLeave={() => setFocus(null)}
                      onClick={() => open(c)}
                    >
                      <title>{`${shortDate(c.date)}: ${c.kg > 0 ? `${formatKg(c.kg)} kg CO2e` : 'nothing logged'}`}</title>
                    </rect>
                  ) : null,
                ),
              )}
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <p aria-live="polite" className="min-h-[1rem] rounded-full bg-fill px-3 py-1 font-medium text-ink tabular-nums">
              {focus ? `${shortDate(focus.date)} · ${focus.kg > 0 ? `${formatKg(focus.kg)} kg CO2e` : 'nothing logged'} · click to open` : 'Hover a day for its total'}
            </p>
            <ul className="flex flex-wrap items-center gap-3" aria-label="Legend, kg CO2e per day">
              {legend.map((l) => (
                <li key={l.level} className="flex items-center gap-1">
                  <svg width={CELL} height={CELL} aria-hidden>
                    <rect width={CELL} height={CELL} rx={2.5} className={`heat-${l.level}`} />
                  </svg>
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ChartCard>
  )
}
