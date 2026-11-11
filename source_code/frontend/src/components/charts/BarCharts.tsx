import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category } from '../../api/types'
import { ChartTooltip } from './ChartTooltip'
import { useChartColors } from './useChartColors'
import { prefersReducedMotion } from '../../lib/motion'

/** Marks grow in once on first draw, unless the user asked for less motion. */
const animate = !prefersReducedMotion()

const axis = (muted: string) => ({ tick: { fill: muted, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }, tickLine: false as const })

/** Grouped bars: this period vs the previous period, per category. */
export function CompareChart({ rows }: { rows: { label: string; short: string; current: number; previous: number }[] }) {
  const c = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="2 4" />
        <XAxis dataKey="short" {...axis(c.muted)} axisLine={{ stroke: c.grid }} interval={0} />
        <YAxis {...axis(c.muted)} axisLine={false} width={52} unit=" kg" allowDecimals={false} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.6, radius: 6 } as object} content={<ChartTooltip heading={(r) => String(r.label)} />} />
        <Bar dataKey="previous" name="Previous period" fill={c.neutral} radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={animate} />
        <Bar dataKey="current" name="This period" fill={c.series} radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={animate} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Horizontal bars, largest first, with the share as a direct label. Identity is also on the axis. */
export function BreakdownChart({ rows }: { rows: { category: Category; label: string; kg: number; share: number }[] }) {
  const c = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 40)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" {...axis(c.muted)} axisLine={false} width={104} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.6, radius: 6 } as object} content={<ChartTooltip />} />
        <Bar dataKey="kg" name="Emissions" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={animate}>
          {rows.map((r) => (
            <Cell key={r.category} fill={c.category[r.category]} />
          ))}
          <LabelList
            dataKey="share"
            position="right"
            fill={c.ink}
            fontSize={12}
            fontWeight={600}
            formatter={(v: number) => `${Math.round(v)}%`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** The user's annualised footprint against published per-person references (one axis: t CO2e / year). */
export function BenchmarkChart({ rows }: { rows: { label: string; tonnes: number; you?: boolean }[] }) {
  const c = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 44)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="2 4" />
        <XAxis type="number" {...axis(c.muted)} axisLine={false} unit=" t" />
        <YAxis type="category" dataKey="label" {...axis(c.muted)} axisLine={false} width={160} />
        <Tooltip cursor={{ fill: c.grid, opacity: 0.6, radius: 6 } as object} content={<ChartTooltip unit="t" />} />
        <Bar dataKey="tonnes" name="t CO2e per year" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={animate}>
          {rows.map((r) => (
            <Cell key={r.label} fill={r.you ? c.series : c.neutral} />
          ))}
          <LabelList dataKey="tonnes" position="right" fill={c.ink} fontSize={12}
            fontWeight={600} formatter={(v: number) => `${v.toFixed(1)}\u00a0t`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
