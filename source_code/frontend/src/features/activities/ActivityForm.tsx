import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { estimate } from './api'
import { useActivity, useFactors, useSaveActivity } from './hooks'
import { ApiError } from '../../api/client'
import type { Activity, ActivityInput, Category, Estimate, Factor, Recurrence } from '../../api/types'
import { useSaveTemplate } from '../planning/hooks'
import { recurrenceOptions } from '../planning/format'
import { Button, ButtonLink, Card, ErrorBanner, PageSkeleton, SelectField, TextField } from '../../components/ui'
import { errorMessage } from '../../app/queryClient'
import { useToast } from '../../components/Toast'
import { useAuth } from '../auth/AuthContext'
import { useHousehold } from '../household/hooks'
import { useT } from '../../lib/i18n'
import { enqueue, isOffline } from '../offline/queue'
import { categoryGlyph } from './ActivityRow'
import { categories, categoryLabel, formatKg, localToday, unitLabel } from '../../lib/format'

function Glyph({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const pill = (active: boolean) =>
  `min-h-[32px] rounded-full px-3 text-xs font-semibold transition-colors active:scale-95 ${
    active ? 'bg-primary text-primary-ink' : 'liquid-capsule text-muted hover:text-ink'
  }`

export default function ActivityForm() {
  const { id } = useParams()
  const factors = useFactors()
  const existing = useActivity(id)

  if (factors.isPending || (id && existing.isPending)) return <PageSkeleton />
  if (factors.isError) return <ErrorBanner message={errorMessage(factors.error, 'Could not load factors')} />
  if (existing.isError) return <ErrorBanner message={errorMessage(existing.error, 'Could not load the activity')} />
  // Keyed so that navigating from one edit page to another starts from fresh form state.
  return <FormBody key={id ?? 'new'} factors={factors.data} existing={existing.data ?? null} />
}

function FormBody({ factors, existing }: { factors: Factor[]; existing: Activity | null }) {
  const navigate = useNavigate()
  const save = useSaveActivity()
  const saveTemplate = useSaveTemplate()
  const toast = useToast()
  const { state } = useAuth()
  // Only categories the server has active factors for are offered, in the fixed display order.
  const available = useMemo(() => categories.filter((c) => factors.some((f) => f.category === c)), [factors])
  const [category, setCategory] = useState<Category>(existing?.category ?? 'TRANSPORT')
  const options = useMemo(() => factors.filter((f) => f.category === category), [factors, category])
  const [subtype, setSubtype] = useState(existing?.subtype ?? options[0]?.subtype ?? '')
  const [quantity, setQuantity] = useState(existing ? String(existing.share?.totalQuantity ?? existing.quantity) : '')
  const [date, setDate] = useState(existing?.occurredOn ?? localToday())
  const [passengers, setPassengers] = useState(existing?.passengers ?? 1)
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Estimate | null>(null)
  const [recurrence, setRecurrence] = useState<Recurrence>('NONE')
  const [keep, setKeep] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [shared, setShared] = useState(false)
  const household = useHousehold()
  const { t } = useT()
  const members = household.data?.members.length ?? 0
  // Shared entries are one-off home energy or waste; a series or template books for one person only.
  const canShare = !existing && members >= 2 && (category === 'ENERGY' || category === 'WASTE') && recurrence === 'NONE' && !keep
  const readOnly = !!existing?.share && !existing.share.editable
  const splitCount = existing?.share?.count ?? (canShare && shared ? members : 1)

  const factor = options.find((f) => f.subtype === subtype)
  const qty = Number(quantity)
  const qtyValid = quantity.trim() !== '' && Number.isFinite(qty) && qty > 0
  const effectivePassengers = factor?.shareable ? passengers : 1

  const presets = useMemo(() => {
    if (!factor) return []
    switch (factor.unit) {
      case 'KM': return [10, 25, 50, 100].filter((n) => n <= factor.maxQuantity)
      case 'KWH': return [50, 100, 250, 500].filter((n) => n <= factor.maxQuantity)
      case 'MEAL': return [1, 2, 3, 5].filter((n) => n <= factor.maxQuantity)
      case 'EUR': return [10, 25, 50, 100].filter((n) => n <= factor.maxQuantity)
      case 'KG': return [1, 3, 5, 10].filter((n) => n <= factor.maxQuantity)
      default: return []
    }
  }, [factor])

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
    if (canShare && shared) input.shareWithHousehold = true
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
      } else if (!existing && recurrence === 'NONE' && !keep && isOffline(e) && state.status === 'authed') {
        enqueue(state.user.id, input)
        toast({ message: 'Saved on this device. It syncs when you are back online.' })
        navigate('/log')
      } else setFormError('Could not save. Check your connection and try again.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">{existing ? 'Edit activity' : 'Log an activity'}</h1>
        <p className="text-muted">Record emissions with cited calculation methodology.</p>
      </header>
      {readOnly && (
        <p role="status" className="flex items-start gap-2.5 rounded-2xl border border-line bg-fill px-4 py-3 text-sm text-ink">
          <Glyph d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <span>{t('share.readOnly')}</span>
        </p>
      )}
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-5">
        <ErrorBanner message={formError} />

        <Card className="space-y-8 p-5 md:p-7">
          <fieldset className="space-y-3">
            <legend className="mb-3 font-display text-lg font-semibold tracking-tight text-ink">Category</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
              {available.map((c) => {
                const isActive = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={isActive}
                    disabled={Boolean(existing)}
                    onClick={() => changeCategory(c)}
                    className={`group relative flex min-h-[88px] flex-col items-start justify-between gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                      isActive
                        ? 'border-ink bg-surface text-ink ring-2 ring-ink'
                        : 'border-line bg-raised text-ink hover:border-field hover:bg-fill disabled:opacity-50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${isActive ? 'bg-brand text-brand-ink' : 'bg-fill text-ink'}`}
                    >
                      <Glyph d={categoryGlyph[c]} />
                    </span>
                    <span className="truncate">{categoryLabel[c]}</span>
                    {isActive && (
                      <span aria-hidden className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-ink">
                        <Glyph d="m5 12 5 5 9-10" className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="border-t border-line" aria-hidden />

          <div className="grid gap-5 md:grid-cols-2">
              <div>
                <SelectField
                  label="Type"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  options={options.map((f) => ({ value: f.subtype, label: f.label }))}
                />
                {errors.subtype && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{errors.subtype}</p>}
              </div>

              <div className="space-y-2">
                <TextField
                  label={`Amount${factor ? ` (${unitLabel(factor.unit)})` : ''}`}
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  error={errors.quantity}
                  autoComplete="off"
                  className="font-display text-lg tabular-nums"
                />
                {presets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted">Presets:</span>
                    {presets.map((val) => (
                      <button key={val} type="button" onClick={() => setQuantity(String(val))} className={`${pill(quantity === String(val))} tabular-nums`}>
                        {val} {unitLabel(factor!.unit)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 md:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">Date</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setDate(localToday())} className={pill(date === localToday())}>
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(`${localToday()}T00:00:00Z`)
                        d.setUTCDate(d.getUTCDate() - 1)
                        setDate(d.toISOString().slice(0, 10))
                      }}
                      className={pill(date !== localToday())}
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
                <TextField
                  label="Date"
                  type="date"
                  value={date}
                  max={localToday()}
                  onChange={(e) => setDate(e.target.value)}
                  error={errors.occurredOn}
                />
              </div>

              {factor?.shareable && (
                <SelectField
                  label="Passengers (including you)"
                  value={String(passengers)}
                  onChange={(e) => setPassengers(Number(e.target.value))}
                  options={Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                />
              )}

              <div className="md:col-span-2">
                <TextField
                  label="Note (optional)"
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                  error={errors.note}
                />
              </div>
          </div>

          {canShare && (
            <div className="rounded-2xl border border-line bg-raised p-4">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-5 w-5 rounded-md accent-[var(--primary)]" />
                <span>{t('share.toggle', { count: members })}</span>
              </label>
              {shared && <p className="mt-1 pl-8 text-xs text-muted">{t('share.note', { count: members })}</p>}
            </div>
          )}
          {existing?.share && !readOnly && <p className="text-xs text-muted">{t('share.note', { count: existing.share.count })}</p>}

          {!existing && (
            <>
              <div className="border-t border-line" aria-hidden />
              <fieldset className="space-y-4">
                <legend className="mb-1 font-display text-lg font-semibold tracking-tight text-ink">Do this often?</legend>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
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
                  </div>
                  <label
                    className={`flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                      keep || recurrence !== 'NONE' ? 'border-ink bg-surface text-ink' : 'border-line bg-raised text-ink hover:bg-fill'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={keep || recurrence !== 'NONE'}
                      disabled={recurrence !== 'NONE'}
                      onChange={(e) => setKeep(e.target.checked)}
                      className="h-5 w-5 rounded-md accent-[var(--primary)]"
                    />
                    <span>Save to quick add</span>
                  </label>
                  {(keep || recurrence !== 'NONE') && (
                    <div className="md:col-span-2">
                      <TextField
                        label="Template name"
                        value={templateName}
                        placeholder={factor?.label}
                        maxLength={60}
                        onChange={(e) => setTemplateName(e.target.value)}
                        error={errors.name}
                      />
                    </div>
                  )}
                </div>
              </fieldset>
            </>
          )}
        </Card>

        <div
          aria-live="polite"
          className={`relative overflow-hidden rounded-card p-5 transition-colors duration-300 md:p-6 ${
            preview && factor ? 'bg-brand text-brand-ink' : 'border border-dashed border-field bg-surface text-muted'
          }`}
        >
          {preview && factor ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Estimated footprint</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink px-2.5 py-1 text-[11px] font-semibold text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                  Live estimate
                </span>
              </div>
              <p className="font-display text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">
                ≈ {formatKg(preview.kgCo2e / splitCount)} kg CO2e
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                <span className="rounded-full border border-brand-ink/25 px-2.5 py-1 font-medium tabular-nums">
                  {formatKg(qty)} {unitLabel(preview.unit)} × {preview.factor.kgCo2ePerUnit} kg per {unitLabel(preview.unit)}
                  {effectivePassengers > 1 ? ` ÷ ${effectivePassengers} people` : ''}
                  {splitCount > 1 ? ` ÷ ${splitCount}` : ''}
                </span>
                <span aria-hidden>·</span>
                <span>{preview.factor.sourceName}</span>
              </div>
              {factor.methodNote && <p className="text-xs italic">{factor.methodNote}</p>}
              <div>
                <Link to="/methodology" className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:no-underline">
                  <span>How this is calculated</span>
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-ink" aria-hidden>
                <Glyph d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Zm0 0 8-8" className="h-4 w-4" />
              </span>
              <p>Enter an amount to see the estimated footprint.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <ButtonLink to="/log" variant="secondary" className="w-full sm:w-auto">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={readOnly || save.isPending || saveTemplate.isPending} className="w-full sm:w-auto sm:min-w-[160px]">
            {save.isPending || saveTemplate.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
