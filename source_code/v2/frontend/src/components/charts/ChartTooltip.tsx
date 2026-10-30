import { formatKg } from '../../lib/format'

interface Item {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number
  payload?: Record<string, unknown>
}

interface Props {
  active?: boolean
  label?: string | number
  payload?: Item[]
  unit?: string
  /** Optional heading derived from the hovered row (e.g. the bucket's date range). */
  heading?: (row: Record<string, unknown>) => string
}

/** Values in text tokens; the colour swatch alone carries series identity. */
export function ChartTooltip({ active, label, payload, unit = 'kg', heading }: Props) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-semibold text-ink">{heading ? heading(row) : label}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {typeof p.value === 'number' ? (unit === 't' ? p.value.toFixed(2) : formatKg(p.value)) : '–'} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
