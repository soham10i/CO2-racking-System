import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category } from '../../api/types'
import type { TrendRow } from '../../features/analytics/series'
import { categoryLabel, shortDate } from '../../lib/format'
import { ChartTooltip } from './ChartTooltip'
import { useChartColors } from './useChartColors'

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
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis
          dataKey="label"
          tick={{ fill: c.muted, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: c.muted, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={compact ? 32 : 52}
          allowDecimals={false}
          unit={compact ? '' : ' kg'}
        />
        <Tooltip
          cursor={{ stroke: c.muted, strokeWidth: 1 }}
          content={<ChartTooltip heading={range} />}
        />
        {mode === 'total' ? (
          <>
            {showPrevious && (
              <Line
                dataKey="previous"
                name="Previous period"
                stroke={c.neutral}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={activeDot(c.neutral)}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="total"
              name="This period"
              stroke={c.series}
              strokeWidth={2}
              dot={false}
              activeDot={activeDot(c.series)}
              isAnimationActive={false}
            />
          </>
        ) : (
          visible.map((cat) => (
            <Line
              key={cat}
              dataKey={cat}
              name={categoryLabel[cat]}
              stroke={c.category[cat]}
              strokeWidth={2}
              dot={false}
              activeDot={activeDot(c.category[cat])}
              isAnimationActive={false}
            />
          ))
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
