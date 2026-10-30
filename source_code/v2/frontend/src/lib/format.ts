import type { Category } from '../api/types'

const kgFormat = new Intl.NumberFormat('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const preciseFormat = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

/** Footprints are shown with one decimal; tiny values keep precision so they never read as 0.0. */
export function formatKg(kg: number): string {
  if (kg > 0 && kg < 0.1) return preciseFormat.format(kg)
  return kgFormat.format(kg)
}

/** Fixed display order; also the order of the categorical colour slots (see index.css). */
export const categories: Category[] = ['TRANSPORT', 'ENERGY', 'DIET', 'SHOPPING', 'WASTE']

export const categoryLabel: Record<Category, string> = {
  TRANSPORT: 'Transport',
  ENERGY: 'Home energy',
  DIET: 'Food',
  SHOPPING: 'Shopping',
  WASTE: 'Waste',
}

const unitNames: Record<string, string> = { KM: 'km', KWH: 'kWh', LITRE: 'L', MEAL: 'meals', ITEM: 'items', EUR: '€', KG: 'kg' }
export const unitLabel = (unit: string) => unitNames[unit] ?? unit.toLowerCase()

export function localToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const pctFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })

/** "+12%" / "−8%"; undefined change (from zero) reads as "new". */
export function formatChange(pct: number | undefined | null): string {
  if (pct === undefined || pct === null) return 'new'
  return `${pctFormat.format(pct)}%`
}

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** ISO date (yyyy-mm-dd) as "3 Mar"; parsed as UTC so the label never shifts a day. */
export const shortDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`))
export const monthLabel = (iso: string) => monthFormat.format(new Date(`${iso}T00:00:00Z`))
