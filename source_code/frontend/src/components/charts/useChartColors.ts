import { useEffect, useState } from 'react'
import { onSchemeChange } from '../../lib/theme'
import type { Category } from '../../api/types'

const categoryVars: Record<Category, string> = {
  TRANSPORT: '--cat-transport',
  ENERGY: '--cat-energy',
  DIET: '--cat-diet',
  SHOPPING: '--cat-shopping',
  WASTE: '--cat-waste',
}

export interface ChartColors {
  category: Record<Category, string>
  /** The single series of a one-measure chart ("this period", "you"). */
  series: string
  /** Recessive comparison marks ("previous period", reference values). */
  neutral: string
  grid: string
  ink: string
  muted: string
  surface: string
  /** Always-lime highlight (fills only; never text on light). */
  brand: string
}

function read(): ChartColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    category: Object.fromEntries(
      Object.entries(categoryVars).map(([c, name]) => [c, v(name, '#999999')]),
    ) as Record<Category, string>,
    series: v('--primary', '#000000'),
    neutral: v('--chart-neutral', '#999999'),
    grid: v('--chart-grid', '#e6e6e6'),
    ink: v('--ink', '#000000'),
    muted: v('--muted', '#595959'),
    surface: v('--surface-solid', '#ffffff'),
    brand: v('--brand', '#0FFF4F'),
  }
}

/**
 * SVG attributes cannot resolve CSS variables, so charts read the design tokens here and re-read them when
 * the colour scheme changes (OS switch or the in-app toggle): dark mode uses its own validated steps, not an
 * automatic inversion.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(read)
  useEffect(() => onSchemeChange(() => setColors(read())), [])
  return colors
}
