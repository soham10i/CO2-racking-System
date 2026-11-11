import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category } from '../../api/types'
import type { TrendRow } from '../../features/analytics/series'
import { categoryLabel, shortDate } from '../../lib/format'
import { ChartTooltip } from './ChartTooltip'
import { useChartColors } from './useChartColors'
import { prefersReducedMotion } from '../../lib/motion'

/** Marks grow in once on first draw, unless the user asked for less motion. */
const animate = !prefersReducedMotion()

interface Props {
  rows: TrendRow[]
  /** "total" draws one line (plus the previous period if present); "category" draws one line per category. */
  mode: 'total' | 'category'
  visible?: Category[]
  height?: number
  compact?: boolean
}

const range = (r: Record<string, unknown>) =>
  r.start === r.end ? shortDate(String(r.start)) : `${shortDate(String(r.start))} – ${shortDate(String(r.end))}`

export function TrendChart({ rows, mode, visible = [], height = 280, compact = false }: Props) {
  const c = useChartColors()
  const showPrevious = mode === 'total' && rows.some((r) => r.previous !== undefined)
  const activeDot = (color: string) => ({ r: 4, fill: color, stroke: c.surface, strokeWidth: 2 })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.series} stopOpacity={0.18} />
            <stop offset="100%" stopColor={c.series} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="2 4" />
        <XAxis
          dataKey="label"
          tick={{ fill: c.muted, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: c.muted, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}
          tickLine={false}
          axisLine={false}
          width={compact ? 32 : 52}
          allowDecimals={false}
          unit={compact ? '' : ' kg'}
        />
        <Tooltip
          cursor={{ stroke: c.muted, strokeWidth: 1, strokeDasharray: '3 3' }}
          content={<ChartTooltip heading={range} />}
        />
        {mode === 'total' ? (
          <>
            {showPrevious && (
              <Line
                type="monotone"
                dataKey="previous"
                name="Previous period"
                stroke={c.neutral}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={activeDot(c.neutral)}
                isAnimationActive={animate}
              />
            )}
            <Area
              type="monotone"
              dataKey="total"
              name="This period"
              stroke={c.series}
              fill="url(#trend-fill)"
              strokeWidth={2}
              dot={false}
              activeDot={activeDot(c.series)}
              isAnimationActive={animate}
            />
          </>
        ) : (
          visible.map((cat) => (
            <Line
              type="monotone"
              key={cat}
              dataKey={cat}
              name={categoryLabel[cat]}
              stroke={c.category[cat]}
              strokeWidth={2}
              dot={false}
              activeDot={activeDot(c.category[cat])}
              isAnimationActive={animate}
            />
          ))
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
