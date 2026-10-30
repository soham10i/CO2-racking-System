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
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {body}
      </Card>
    )

  const last = step === STEPS.length - 1

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (wizard && !last) setStep(step + 1)
        else void submit()
      }}
    >
      {wizard && (
        <ol className="flex gap-2 text-sm" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={`rounded-full px-3 py-1 ${i === step ? 'bg-primary text-primary-ink' : 'border border-line text-muted'}`}>
              {i + 1}. {s}
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={p.digestOptIn} onChange={(e) => set('digestOptIn', e.target.checked)} />
          Email me a weekly summary
        </label>
      </>)}

      <div className="flex items-center gap-3">
        {wizard && step > 0 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button type="submit" disabled={busy}>{wizard && !last ? 'Next' : busy ? 'Saving…' : submitLabel}</Button>
        {saved && <span role="status" className="text-sm text-primary">Saved</span>}
      </div>
    </form>
  )
}
