import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { previewBaseline } from './api'
import { ApiError } from '../../api/client'
import type { Baseline, BaselineAnswers, CarFuel, Category, HeatingType, Profile } from '../../api/types'
import { FUEL, HEATING } from '../account/ProfileEditor'
import { Button, ErrorBanner, SelectField, TextField } from '../../components/ui'
import { categories, categoryLabel, formatKg } from '../../lib/format'

type NumberKey = { [K in keyof BaselineAnswers]-?: BaselineAnswers[K] extends number ? K : never }[keyof BaselineAnswers]

const fields: { section: string; items: { key: NumberKey; label: string; hint?: string }[] }[] = [
  {
    section: 'Getting around',
    items: [
      { key: 'carKmPerWeek', label: 'Car km a week', hint: 'Your share; leave 0 if you don’t drive' },
      { key: 'busKmPerWeek', label: 'Bus km a week' },
      { key: 'trainKmPerWeek', label: 'Train km a week' },
      { key: 'shortHaulReturnFlightsPerYear', label: 'Short-haul return flights a year', hint: 'Within Europe, under ~3 hours' },
      { key: 'longHaulReturnFlightsPerYear', label: 'Long-haul return flights a year' },
    ],
  },
  {
    section: 'Home',
    items: [
      { key: 'householdSize', label: 'People in your household', hint: 'Home energy and waste are split between them' },
      { key: 'electricityKwhPerYear', label: 'Electricity, kWh a year', hint: 'From your bill; a typical flat uses 1,500–3,000' },
    ],
  },
  {
    section: 'Food',
    items: [
      { key: 'beefOrLambMealsPerWeek', label: 'Beef or lamb meals a week' },
      { key: 'otherMeatMealsPerWeek', label: 'Other meat or fish meals a week' },
    ],
  },
  {
    section: 'Shopping and waste',
    items: [
      { key: 'phonesPerYear', label: 'New phones a year', hint: 'Whole numbers; 0 if you keep yours for years' },
      { key: 'laptopsPerYear', label: 'New laptops a year' },
      { key: 'clothingItemsPerYear', label: 'New clothing items a year' },
      { key: 'residualWasteKgPerWeek', label: 'General waste, kg a week', hint: 'A full kitchen bin bag is roughly 5 kg' },
      { key: 'recyclingKgPerWeek', label: 'Recycling, kg a week' },
    ],
  },
]

export function emptyAnswers(profile?: Profile): BaselineAnswers {
  return {
    householdSize: profile?.householdSize ?? 1,
    carFuel: profile?.car?.fuel ?? null,
    carKmPerWeek: 0,
    busKmPerWeek: 0,
    trainKmPerWeek: 0,
    shortHaulReturnFlightsPerYear: 0,
    longHaulReturnFlightsPerYear: 0,
    electricityKwhPerYear: 0,
    heatingType: profile?.heatingType ?? null,
    heatingPerYear: 0,
    beefOrLambMealsPerWeek: 0,
    otherMeatMealsPerWeek: 0,
    vegan: profile?.dietType === 'VEGAN',
    phonesPerYear: 0,
    laptopsPerYear: 0,
    clothingItemsPerYear: 0,
    residualWasteKgPerWeek: 0,
    recyclingKgPerWeek: 0,
  }
}

const text = (a: BaselineAnswers) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]))

/** The 5-minute questionnaire. The estimate is always computed by the server, previewed live as you type. */
export function BaselineForm({
  initial,
  submitLabel,
  onSubmit,
  secondary,
}: {
  initial: BaselineAnswers
  submitLabel: string
  onSubmit: (answers: BaselineAnswers) => Promise<void>
  secondary?: ReactNode
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => text(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Baseline | null>(null)
  const [busy, setBusy] = useState(false)

  const numberKeys = fields.flatMap((s) => s.items.map((i) => i.key)).concat('heatingPerYear')
  const invalid = numberKeys.filter((k) => {
    const raw = String(values[k] ?? '').trim()
    return raw === '' || !Number.isInteger(Number(raw)) || Number(raw) < 0
  })
  const answers: BaselineAnswers | null =
    invalid.length > 0
      ? null
      : ({
          ...values,
          ...Object.fromEntries(numberKeys.map((k) => [k, Number(values[k])])),
          carFuel: values.carFuel || null,
          heatingType: values.heatingType || null,
        } as BaselineAnswers)
  const key = answers ? JSON.stringify(answers) : null

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const timer = setTimeout(() => {
      previewBaseline(JSON.parse(key) as BaselineAnswers).then(
        (b) => !cancelled && setPreview(b),
        () => undefined,
      )
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key])

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }))

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setFormError(null)
    if (!answers) {
      setErrors(Object.fromEntries(invalid.map((k) => [k, 'Enter a whole number, 0 or more'])))
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await onSubmit(answers)
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.length > 0) setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message])))
      else setFormError(e instanceof ApiError ? e.message : 'Could not save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const heatingUnit = values.heatingType === 'HEATING_OIL' ? 'litres' : 'kWh'
  const numberField = (k: NumberKey | 'heatingPerYear', label: string, hint?: string) => (
    <TextField
      key={k}
      label={label}
      inputMode="numeric"
      value={String(values[k] ?? '')}
      onChange={(e) => set(k, e.target.value)}
      error={errors[k] ?? (invalid.includes(k) && String(values[k] ?? '') !== '' ? 'Enter a whole number, 0 or more' : undefined)}
      {...(hint ? { hint } : {})}
    />
  )

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-6">
      <ErrorBanner message={formError} />
      {fields.map((s) => (
        <fieldset key={s.section} className="space-y-3">
          <legend className="mb-1 text-lg font-semibold">{s.section}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.items.map((i) => numberField(i.key, i.label, i.hint))}
            {s.section === 'Getting around' && (
              <SelectField label="Car fuel" options={FUEL} value={String(values.carFuel ?? '')} onChange={(e) => set('carFuel', e.target.value as CarFuel)} />
            )}
            {s.section === 'Home' && (
              <>
                <SelectField label="Main heating" options={HEATING} value={String(values.heatingType ?? '')} onChange={(e) => set('heatingType', e.target.value as HeatingType)} />
                {numberField('heatingPerYear', `Heating, ${heatingUnit} a year`, 'From your bill; 0 if it is included in electricity')}
              </>
            )}
            {s.section === 'Food' && (
              <label className="flex min-h-[44px] items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="h-5 w-5" checked={Boolean(values.vegan)} onChange={(e) => set('vegan', e.target.checked)} />
                My other meals are vegan (no dairy or eggs)
              </label>
            )}
          </div>
        </fieldset>
      ))}

      <div aria-live="polite" className="sticky bottom-0 -mx-1 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <span className="text-2xl font-semibold tabular-nums">{preview ? preview.annualTonnes.toFixed(1) : '–'}</span>
            <span className="text-sm text-muted"> t CO2e a year (estimate)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {secondary}
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : submitLabel}
            </Button>
          </div>
        </div>
        {preview && <CategoryBars rows={preview.byCategory} compact />}
      </div>
    </form>
  )
}

const fill: Record<Category, string> = {
  TRANSPORT: 'fill-cat-transport',
  ENERGY: 'fill-cat-energy',
  DIET: 'fill-cat-diet',
  SHOPPING: 'fill-cat-shopping',
  WASTE: 'fill-cat-waste',
}

/** Horizontal bars per category on one shared scale, labelled directly. */
export function CategoryBars({ rows, compact = false }: { rows: { category: Category; annualKg: number }[]; compact?: boolean }) {
  const byCat = new Map(rows.map((r) => [r.category, r.annualKg]))
  const max = Math.max(1, ...rows.map((r) => r.annualKg))
  return (
    <ul className={compact ? 'mt-2 grid gap-1 sm:grid-cols-5' : 'space-y-2'}>
      {categories.map((c) => {
        const kg = byCat.get(c) ?? 0
        return (
          <li key={c} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className={compact ? 'text-xs text-muted' : ''}>{categoryLabel[c]}</span>
              <span className={`tabular-nums ${compact ? 'text-xs text-muted' : 'font-medium'}`}>{compact ? `${(kg / 1000).toFixed(1)} t` : `${formatKg(kg)} kg`}</span>
            </div>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" className={`w-full ${compact ? 'h-1.5' : 'h-2.5'}`} aria-hidden>
              <rect x="0" y="0" width="100" height="4" rx="2" className="fill-fill" />
              {kg > 0 && <rect x="0" y="0" width={Math.max(2, (kg / max) * 100)} height="4" rx="2" className={fill[c]} />}
            </svg>
          </li>
        )
      })}
    </ul>
  )
}
