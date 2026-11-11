import { useState, type ReactNode } from 'react'
import { ApiError } from '../../api/client'
import type { CarFuel, CommuteMode, DietType, HeatingType, Profile, ShoppingHabit, Units } from '../../api/types'
import { Button, Card, ErrorBanner, SelectField, TextField } from '../../components/ui'

type Opt<T extends string> = { value: T | ''; label: string }

const COUNTRIES: Opt<string>[] = [
  { value: '', label: 'Select…' },
  { value: 'DE', label: 'Germany' }, { value: 'AT', label: 'Austria' }, { value: 'CH', label: 'Switzerland' },
  { value: 'FR', label: 'France' }, { value: 'NL', label: 'Netherlands' }, { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' }, { value: 'GB', label: 'United Kingdom' }, { value: 'US', label: 'United States' },
  { value: 'IN', label: 'India' },
]
export const HEATING: Opt<HeatingType>[] = [
  { value: '', label: 'Select…' }, { value: 'NATURAL_GAS', label: 'Natural gas' }, { value: 'HEATING_OIL', label: 'Heating oil' },
  { value: 'ELECTRIC', label: 'Electric' }, { value: 'HEAT_PUMP', label: 'Heat pump' }, { value: 'DISTRICT', label: 'District heating' },
  { value: 'WOOD', label: 'Wood / pellets' }, { value: 'OTHER', label: 'Other' },
]
const COMMUTE: Opt<CommuteMode>[] = [
  { value: '', label: 'Select…' }, { value: 'CAR', label: 'Car' }, { value: 'PUBLIC_TRANSPORT', label: 'Public transport' },
  { value: 'BIKE', label: 'Bike' }, { value: 'WALK', label: 'Walk' }, { value: 'REMOTE', label: 'Work remotely' },
]
export const FUEL: Opt<CarFuel>[] = [
  { value: '', label: 'Select…' }, { value: 'PETROL', label: 'Petrol' }, { value: 'DIESEL', label: 'Diesel' },
  { value: 'HYBRID', label: 'Hybrid' }, { value: 'ELECTRIC', label: 'Electric' }, { value: 'LPG', label: 'LPG' },
]
const DIET: Opt<DietType>[] = [
  { value: '', label: 'Select…' }, { value: 'VEGAN', label: 'Vegan' }, { value: 'VEGETARIAN', label: 'Vegetarian' },
  { value: 'PESCATARIAN', label: 'Pescatarian' }, { value: 'LOW_MEAT', label: 'Low meat' }, { value: 'OMNIVORE', label: 'Omnivore' },
  { value: 'HIGH_MEAT', label: 'High meat' },
]
const SHOPPING: Opt<ShoppingHabit>[] = [
  { value: '', label: 'Select…' }, { value: 'MINIMAL', label: 'Minimal: buy only what I need' },
  { value: 'MODERATE', label: 'Moderate' }, { value: 'FREQUENT', label: 'Frequent' },
]
const UNITS: Opt<Units>[] = [{ value: 'METRIC', label: 'Metric (km, kg)' }, { value: 'IMPERIAL', label: 'Imperial (mi, lb)' }]

const STEPS = ['Home', 'Transport', 'Food & shopping']
const BLURBS = [
  'Where you live and who you share energy with.',
  'How you usually travel, and the car if you have one.',
  'What you eat and how often you shop.',
]
const ICONS = [
  'M4 11 12 4l8 7v9h-5v-6h-6v6H4v-9Z',
  'M5 16V9.5L7 5h10l2 4.5V16M5 16h14M5 16v2m14-2v2M7.5 12.5h.01m9 0h.01',
  'M6 3v8a3 3 0 0 0 6 0V3M9 3v18m6-18c-1.5 1-2 3.5-2 6s1 3 2 3v9',
]

function toNum(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

interface Props {
  initial: Profile
  wizard?: boolean
  submitLabel: string
  onSubmit: (profile: Profile) => Promise<void>
}

export function ProfileEditor({ initial, wizard = false, submitLabel, onSubmit }: Props) {
  const [p, setP] = useState<Profile>(initial)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setSaved(false)
    setP((prev) => ({ ...prev, [key]: value }))
  }
  const sel = <T extends string>(v: string): T | null => (v === '' ? null : (v as T))
  const timezones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const show = (i: number) => !wizard || step === i

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await onSubmit(p)
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldErrors[0] ? `${e.fieldErrors[0].field}: ${e.fieldErrors[0].message}` : e.message) : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const section = (i: number, title: string, body: ReactNode) =>
    show(i) && (
      <Card className="p-6 md:p-8">
        <div className="flex items-start gap-4 border-b border-line pb-5">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[i]} />
            </svg>
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted">{BLURBS[i]}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">{body}</div>
      </Card>
    )

  const last = step === STEPS.length - 1

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (wizard && !last) setStep(step + 1)
        else void submit()
      }}
    >
      {wizard && (
        <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className="min-w-0">
              <span
                aria-hidden
                className={`block h-1.5 rounded-full transition-colors ${i <= step ? 'bg-brand' : 'bg-fill-strong'}`}
              />
              <span className={`mt-2.5 flex items-center gap-2 text-xs font-semibold sm:text-sm ${i === step ? 'text-ink' : 'text-muted'}`}>
                <span
                  aria-hidden={i < step ? true : undefined}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] tabular-nums ${
                    i === step ? 'bg-primary text-primary-ink' : i < step ? 'bg-brand text-brand-ink' : 'border border-field/60 text-muted'
                  }`}
                >
                  {i < step ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  ) : null}
                  <span className={i < step ? 'sr-only' : ''}>{i + 1}.</span>
                </span>
                <span className="truncate">{s}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <ErrorBanner message={error} />

      {section(0, 'Home', <>
        <TextField label="Display name" value={p.displayName} maxLength={80} required onChange={(e) => set('displayName', e.target.value)} />
        <SelectField label="Country" options={COUNTRIES} value={p.country ?? ''} onChange={(e) => set('country', e.target.value || null)} />
        <TextField label="Timezone" list="tz-list" value={p.timezone} onChange={(e) => set('timezone', e.target.value)} hint="Used to decide which day an activity belongs to." />
        <datalist id="tz-list">{timezones.map((z) => <option key={z} value={z} />)}</datalist>
        <TextField label="People in your household" type="number" min={1} max={20} value={p.householdSize ?? ''} onChange={(e) => set('householdSize', toNum(e.target.value))} />
        <SelectField label="Main heating" options={HEATING} value={p.heatingType ?? ''} onChange={(e) => set('heatingType', sel<HeatingType>(e.target.value))} />
        <SelectField label="Units" options={UNITS as Opt<string>[]} value={p.units} onChange={(e) => set('units', e.target.value as Units)} />
      </>)}

      {section(1, 'Transport', <>
        <SelectField label="How do you usually get around?" options={COMMUTE} value={p.commuteMode ?? ''} onChange={(e) => set('commuteMode', sel<CommuteMode>(e.target.value))} />
        <SelectField label="Car fuel (if you have one)" options={FUEL} value={p.car?.fuel ?? ''} onChange={(e) => set('car', { ...p.car, fuel: sel<CarFuel>(e.target.value) })} />
        <TextField label="Car emissions (g CO2 per km)" type="number" min={0} max={1000} value={p.car?.gPerKm ?? ''} hint="Leave empty to use the average for the fuel type." onChange={(e) => set('car', { ...p.car, gPerKm: toNum(e.target.value) })} />
      </>)}

      {section(2, 'Food & shopping', <>
        <SelectField label="Diet" options={DIET} value={p.dietType ?? ''} onChange={(e) => set('dietType', sel<DietType>(e.target.value))} />
        <SelectField label="Shopping habits" options={SHOPPING} value={p.shoppingHabit ?? ''} onChange={(e) => set('shoppingHabit', sel<ShoppingHabit>(e.target.value))} />
        <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 rounded-xl border border-field/60 bg-surface px-4 py-3 text-[15px] font-medium transition-colors hover:border-field md:col-span-2">
          Email me a weekly summary
          <input type="checkbox" className="switch" checked={p.digestOptIn} onChange={(e) => set('digestOptIn', e.target.checked)} />
        </label>
      </>)}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {saved && (
          <span role="status" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-ink sm:mr-auto">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-ink">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5 9-10" />
              </svg>
            </span>
            Saved
          </span>
        )}
        {wizard && step > 0 && <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button type="submit" className="w-full min-h-[48px] sm:w-auto sm:min-w-[9rem]" disabled={busy}>{wizard && !last ? 'Next' : busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}
