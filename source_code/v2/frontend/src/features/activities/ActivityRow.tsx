import type { ReactNode } from 'react'
import type { Activity, Category } from '../../api/types'
import { categoryLabel, formatKg, unitLabel } from '../../lib/format'

// Outline glyphs on the same 24px / 1.8 stroke grid as the sidebar icons.
const glyphs: Record<Category, string> = {
  TRANSPORT: 'M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2m14-2v2M5 11h14M8 13.5h.01M16 13.5h.01',
  ENERGY: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z',
  DIET: 'M7 3v8m-2-8v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7h3',
  SHOPPING: 'M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2',
  WASTE: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
}

// Static class names so Tailwind keeps them; colours come from the validated chart palette.
const tile: Record<Category, string> = {
  TRANSPORT: 'bg-cat-transport',
  ENERGY: 'bg-cat-energy',
  DIET: 'bg-cat-diet',
  SHOPPING: 'bg-cat-shopping',
  WASTE: 'bg-cat-waste',
}

export function CategoryTile({ category, size = 36 }: { category: Category; size?: number }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[10px] text-white shadow-sm ${tile[category]} ${size === 36 ? 'h-9 w-9' : 'h-7 w-7'}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className={size === 36 ? 'h-5 w-5' : 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={glyphs[category]} />
      </svg>
    </span>
  )
}

/** One activity as an inset-list row: tile, what and how much, footprint, optional trailing actions. */
export function ActivityRow({ activity: a, meta, actions }: { activity: Activity; meta?: string; actions?: ReactNode }) {
  const details = [
    meta,
    categoryLabel[a.category],
    `${a.quantity} ${a.quantity === 1 ? unitLabel(a.unit).replace(/s$/, '') : unitLabel(a.unit)}`,
    a.passengers > 1 ? `${a.passengers} people` : null,
  ].filter(Boolean)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <CategoryTile category={a.category} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug sm:truncate">{a.label}</p>
        <p className="text-sm text-muted sm:truncate">
          {details.join(' · ')}
          {a.note ? <span className="italic"> · {a.note}</span> : null}
        </p>
      </div>
      <p className="shrink-0 text-right tabular-nums">
        <span className="font-semibold">{formatKg(a.kgCo2e)}</span>
        <span className="block text-xs text-muted">kg CO2e</span>
      </p>
      {actions}
    </div>
  )
}
