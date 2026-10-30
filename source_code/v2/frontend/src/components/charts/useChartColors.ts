import { useEffect, useState } from 'react'
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
}

function read(): ChartColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    category: Object.fromEntries(
      Object.entries(categoryVars).map(([c, name]) => [c, v(name, '#2a78d6')]),
    ) as Record<Category, string>,
    series: v('--cat-transport', '#2a78d6'),
    neutral: v('--chart-neutral', '#9aa8a0'),
    grid: v('--chart-grid', '#e6ece8'),
    ink: v('--ink', '#13261c'),
    muted: v('--muted', '#4f6458'),
    surface: v('--surface-solid', '#ffffff'),
  }
}

/**
 * SVG attributes cannot resolve CSS variables, so charts read the design tokens here and re-read them when
 * the colour scheme changes: dark mode uses its own validated steps, not an automatic inversion.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const update = () => setColors(read())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return colors
}
