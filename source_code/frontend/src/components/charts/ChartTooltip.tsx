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
    <div className="min-w-[160px] rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs shadow-lg shadow-black/10">
      <p className="mb-1.5 border-b border-line pb-1.5 font-display text-[13px] font-semibold tracking-tight text-ink">{heading ? heading(row) : label}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-line" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-display font-semibold tabular-nums text-ink">
              {typeof p.value === 'number' ? (unit === 't' ? p.value.toFixed(2) : formatKg(p.value)) : '–'} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
