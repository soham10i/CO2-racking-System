import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { estimate } from './api'
import { useActivity, useFactors, useSaveActivity } from './hooks'
import { ApiError } from '../../api/client'
import type { Activity, ActivityInput, Category, Estimate, Factor, Recurrence } from '../../api/types'
import { useSaveTemplate } from '../planning/hooks'
import { recurrenceOptions } from '../planning/format'
import { Button, ButtonLink, Card, ErrorBanner, SelectField, Spinner, TextField } from '../../components/ui'
import { errorMessage } from '../../app/queryClient'
import { categories, categoryLabel, formatKg, localToday, unitLabel } from '../../lib/format'

export default function ActivityForm() {
  const { id } = useParams()
  const factors = useFactors()
  const existing = useActivity(id)

  if (factors.isPending || (id && existing.isPending)) return <Spinner />
  if (factors.isError) return <ErrorBanner message={errorMessage(factors.error, 'Could not load factors')} />
  if (existing.isError) return <ErrorBanner message={errorMessage(existing.error, 'Could not load the activity')} />
  // Keyed so that navigating from one edit page to another starts from fresh form state.
  return <FormBody key={id ?? 'new'} factors={factors.data} existing={existing.data ?? null} />
}

function FormBody({ factors, existing }: { factors: Factor[]; existing: Activity | null }) {
  const navigate = useNavigate()
  const save = useSaveActivity()
  const saveTemplate = useSaveTemplate()
  // Only categories the server has active factors for are offered, in the fixed display order.
  const available = useMemo(() => categories.filter((c) => factors.some((f) => f.category === c)), [factors])
  const [category, setCategory] = useState<Category>(existing?.category ?? 'TRANSPORT')
  const options = useMemo(() => factors.filter((f) => f.category === category), [factors, category])
  const [subtype, setSubtype] = useState(existing?.subtype ?? options[0]?.subtype ?? '')
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : '')
  const [date, setDate] = useState(existing?.occurredOn ?? localToday())
  const [passengers, setPassengers] = useState(existing?.passengers ?? 1)
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Estimate | null>(null)
  const [recurrence, setRecurrence] = useState<Recurrence>('NONE')
  const [keep, setKeep] = useState(false)
  const [templateName, setTemplateName] = useState('')

  const factor = options.find((f) => f.subtype === subtype)
  const qty = Number(quantity)
  const qtyValid = quantity.trim() !== '' && Number.isFinite(qty) && qty > 0
  const effectivePassengers = factor?.shareable ? passengers : 1

  function changeCategory(next: Category) {
    setCategory(next)
    setSubtype(factors.find((f) => f.category === next)?.subtype ?? '')
    setPassengers(1)
    setErrors({})
  }

  // Live preview: the server is the only place numbers are computed, so ask it (debounced).
  useEffect(() => {
    setPreview(null)
    if (!factor || !qtyValid || qty > factor.maxQuantity) return
    let cancelled = false
    const timer = setTimeout(() => {
      const input = { category, subtype, quantity: qty, occurredOn: date, passengers: effectivePassengers }
      estimate(input).then(
        (e) => !cancelled && setPreview(e),
        () => undefined,
      )
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [category, subtype, qty, qtyValid, date, effectivePassengers, factor])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!factor) e.subtype = 'Choose a type'
    if (!qtyValid) e.quantity = 'Enter an amount greater than 0'
    else if (factor && qty > factor.maxQuantity) {
      e.quantity = `Must be at most ${factor.maxQuantity} ${unitLabel(factor.unit)}`
    }
    if (!existing && (keep || recurrence !== 'NONE') && templateName.trim().length > 60) e.name = 'At most 60 characters'
    if (!date) e.occurredOn = 'Pick a date'
    else if (date > localToday()) e.occurredOn = 'The date cannot be in the future'
    return e
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setFormError(null)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const input: ActivityInput = { category, subtype, quantity: qty, occurredOn: date, passengers: effectivePassengers }
    if (note.trim()) input.note = note.trim()
    try {
      if (existing) await save.mutateAsync({ id: existing.id, input: { ...input, version: existing.version } })
      else if (recurrence !== 'NONE' || keep) {
        const name = templateName.trim() || factor!.label.slice(0, 60)
        const { occurredOn: _, ...rest } = input
        if (recurrence !== 'NONE') {
          // The server books the series from its start date on, this entry included.
          await saveTemplate.mutateAsync({ input: { ...rest, name, recurrence, startsOn: date } })
        } else {
          await save.mutateAsync({ input })
          await saveTemplate.mutateAsync({ input: { ...rest, name, recurrence: 'NONE' } })
        }
      } else await save.mutateAsync({ input })
      navigate('/log')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.fieldErrors.length > 0) {
          setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message])))
        } else if (e.code === 'quantity_out_of_range') setErrors({ quantity: e.message })
        else if (e.code === 'date_in_future' || e.code === 'date_too_old') setErrors({ occurredOn: e.message })
        else setFormError(e.status === 409 ? 'This entry was changed elsewhere. Reload the page and try again.' : e.message)
      } else setFormError('Could not save. Check your connection and try again.')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{existing ? 'Edit activity' : 'Log an activity'}</h1>
      <Card>
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4">
          <ErrorBanner message={formError} />

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Category</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {available.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  disabled={Boolean(existing)}
                  onClick={() => changeCategory(c)}
                  className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed ${
                    category === c ? 'border-primary bg-primary text-primary-ink shadow-sm' : 'border-transparent bg-fill text-ink hover:bg-fill-strong'
                  }`}
                >
                  {categoryLabel[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <SelectField
              label="Type"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              options={options.map((f) => ({ value: f.subtype, label: f.label }))}
            />
            {errors.subtype && <p role="alert" className="mt-1 text-sm text-danger">{errors.subtype}</p>}
          </div>

          <TextField
            label={`Amount${factor ? ` (${unitLabel(factor.unit)})` : ''}`}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={errors.quantity}
            autoComplete="off"
          />

          <TextField
            label="Date"
            type="date"
            value={date}
            max={localToday()}
            onChange={(e) => setDate(e.target.value)}
            error={errors.occurredOn}
          />

          {factor?.shareable && (
            <SelectField
              label="Passengers (including you)"
              value={String(passengers)}
              onChange={(e) => setPassengers(Number(e.target.value))}
              options={Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            />
          )}

          <TextField
            label="Note (optional)"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            error={errors.note}
          />

          {!existing && (
            <fieldset className="space-y-3 rounded-xl border border-line p-3">
              <legend className="px-1 text-sm font-medium">Do this often?</legend>
              <SelectField
                label="Repeat"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                options={recurrenceOptions}
              />
              {recurrence !== 'NONE' && (
                <p className="text-xs text-muted">
                  Logged automatically from {date === localToday() ? 'today' : date} on — handy for bills and commutes. Stop
                  it any time under Templates.
                </p>
              )}
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={keep || recurrence !== 'NONE'}
                  disabled={recurrence !== 'NONE'}
                  onChange={(e) => setKeep(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Save to quick add
              </label>
              {(keep || recurrence !== 'NONE') && (
                <TextField
                  label="Template name"
                  value={templateName}
                  placeholder={factor?.label}
                  maxLength={60}
                  onChange={(e) => setTemplateName(e.target.value)}
                  error={errors.name}
                />
              )}
            </fieldset>
          )}

          <div aria-live="polite" className="rounded-xl bg-fill p-3 text-sm">
            {preview && factor ? (
              <>
                <p className="text-lg font-semibold tabular-nums">≈ {formatKg(preview.kgCo2e)} kg CO2e</p>
                <p className="text-muted">
                  {formatKg(qty)} {unitLabel(preview.unit)} × {preview.factor.kgCo2ePerUnit} kg per {unitLabel(preview.unit)}
                  {effectivePassengers > 1 ? ` ÷ ${effectivePassengers} people` : ''} · {preview.factor.sourceName}
                </p>
                {factor.methodNote && <p className="mt-1 text-xs text-muted">{factor.methodNote}</p>}
                <Link to="/methodology" className="mt-1 inline-block text-xs font-medium text-accent underline">
                  How this is calculated
                </Link>
              </>
            ) : (
              <p className="text-muted">Enter an amount to see the estimated footprint.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending || saveTemplate.isPending} className="flex-1">
              {save.isPending || saveTemplate.isPending ? 'Saving…' : 'Save'}
            </Button>
            <ButtonLink to="/log" variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  )
}
