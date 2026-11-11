import type { Category } from '../api/types'
import { currentLocale, type Locale } from './i18n'

/** Intl formatters are costly to build, so each one is made once per locale. */
function perLocale<T>(make: (locale: Locale) => T): () => T {
  const cache = new Map<Locale, T>()
  return () => {
    const l = currentLocale()
    let f = cache.get(l)
    if (!f) cache.set(l, (f = make(l)))
    return f
  }
}

const kgFormat = perLocale((l) => new Intl.NumberFormat(l, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
const preciseFormat = perLocale((l) => new Intl.NumberFormat(l, { minimumFractionDigits: 2, maximumFractionDigits: 3 }))

/** Footprints are shown with one decimal; tiny values keep precision so they never read as 0.0. */
export function formatKg(kg: number): string {
  if (kg > 0 && kg < 0.1) return preciseFormat().format(kg)
  return kgFormat().format(kg)
}

/** Fixed display order; also the order of the categorical colour slots (see index.css). */
export const categories: Category[] = ['TRANSPORT', 'ENERGY', 'DIET', 'SHOPPING', 'WASTE']

const categoryNames: Record<Locale, Record<Category, string>> = {
  en: { TRANSPORT: 'Transport', ENERGY: 'Home energy', DIET: 'Food', SHOPPING: 'Shopping', WASTE: 'Waste' },
  de: { TRANSPORT: 'Mobilität', ENERGY: 'Wohnenergie', DIET: 'Ernährung', SHOPPING: 'Konsum', WASTE: 'Abfall' },
}

/** Read like a record (`categoryLabel[c]`); each lookup uses the active language. */
export const categoryLabel = Object.fromEntries(
  categories.map((c) => [c, undefined]),
) as unknown as Record<Category, string>
for (const c of categories) {
  Object.defineProperty(categoryLabel, c, { enumerable: true, get: () => categoryNames[currentLocale()][c] })
}

const unitNames: Record<Locale, Record<string, string>> = {
  en: { KM: 'km', KWH: 'kWh', LITRE: 'L', MEAL: 'meals', ITEM: 'items', EUR: '€', KG: 'kg' },
  de: { KM: 'km', KWH: 'kWh', LITRE: 'l', MEAL: 'Mahlzeiten', ITEM: 'Stück', EUR: '€', KG: 'kg' },
}
export const unitLabel = (unit: string) => unitNames[currentLocale()][unit] ?? unit.toLowerCase()

export function localToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const pctFormat = perLocale((l) => new Intl.NumberFormat(l, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }))

/** "+12%" / "−8%"; undefined change (from zero) reads as "new". */
export function formatChange(pct: number | undefined | null): string {
  if (pct === undefined || pct === null) return currentLocale() === 'de' ? 'neu' : 'new'
  return `${pctFormat().format(pct)}${currentLocale() === 'de' ? ' %' : '%'}`
}

const dateFormat = perLocale((l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', timeZone: 'UTC' }))
const monthFormat = perLocale((l) => new Intl.DateTimeFormat(l, { month: 'short', year: 'numeric', timeZone: 'UTC' }))
const longDayFormat = perLocale(
  (l) => new Intl.DateTimeFormat(l, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
)

/** ISO date (yyyy-mm-dd) as "3 Mar"; parsed as UTC so the label never shifts a day. */
export const shortDate = (iso: string) => dateFormat().format(new Date(`${iso}T00:00:00Z`))
export const monthLabel = (iso: string) => monthFormat().format(new Date(`${iso}T00:00:00Z`))
/** "Thursday, 29 October" / "Donnerstag, 29. Oktober". */
export const longDay = (iso: string) => longDayFormat().format(new Date(`${iso}T00:00:00Z`))
