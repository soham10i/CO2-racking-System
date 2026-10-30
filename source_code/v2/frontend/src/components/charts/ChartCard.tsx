import { useState, type ReactNode } from 'react'
import { Card } from '../ui'

export interface TableData {
  columns: string[]
  rows: (string | number)[][]
}

interface Props {
  title: string
  /** One-sentence reading of the chart: shown as the caption and used as the chart's accessible name. */
  summary: string
  table: TableData
  actions?: ReactNode
  children: ReactNode
}

/** Every chart has an equivalent table, so no reading depends on colour, hover or a pointer. */
export function ChartCard({ title, summary, table, actions, children }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const toggle = (v: 'chart' | 'table', label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className="segment"
    >
      {label}
    </button>
  )

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div role="group" aria-label={`${title} view`} className="segmented">
            {toggle('chart', 'Chart')}
            {toggle('table', 'Table')}
          </div>
        </div>
      </div>
      {view === 'chart' ? (
        <div role="img" aria-label={`${title}. ${summary}`}>
          {children}
        </div>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 border-b border-line bg-surface text-muted">
              <tr>
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={`p-2 font-medium ${i > 0 ? 'text-right' : ''}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {r.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="p-2 font-normal">
                        {cell}
                      </th>
                    ) : (
                      <td key={j} className="p-2 text-right tabular-nums">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/** Swatch + label legend; dashed swatches mark comparison series. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-4 border-t-2"
            style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
