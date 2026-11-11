import { useMemo, useState, type FormEvent } from 'react'
import { compare } from './api'
import { useFactors } from '../activities/hooks'
import { categoryGlyph } from '../activities/ActivityRow'
import { useAuth } from '../auth/AuthContext'
import { BaselineForm, emptyAnswers } from '../planning/BaselineForm'
import { previewBaseline } from '../planning/api'
import { useBaseline } from '../planning/hooks'
import { ApiError } from '../../api/client'
import type { Baseline, CalculatorComparison, Category, Factor } from '../../api/types'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, ErrorBanner, PageSkeleton, SelectField, TextField } from '../../components/ui'
import { categories, categoryLabel, formatKg, localToday, unitLabel } from '../../lib/format'
import { useT } from '../../lib/i18n'

/** 1.5 °C lifestyle target per person for 2030 (docs/10, reference [3]). */
export const TARGET_2030_T = 2.5
export const TARGET_SOURCE = 'Hot or Cool Institute, 1.5-Degree Lifestyles (2021)'

type Mode = 'compare' | 'yearly'

export default function Calculator() {
  const { t } = useT()
  const [mode, setMode] = useState<Mode>('compare')
  return (
    <div className="space-y-6">
      <header className="max-w-2xl space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('calc.title')}</h1>
        <p className="text-muted">{t('calc.subtitle')}</p>
      </header>
      <div className="segmented" role="group" aria-label={t('calc.tabs')}>
        {(['compare', 'yearly'] as const).map((m) => (
          <button key={m} type="button" className="segment" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(m === 'compare' ? 'calc.tab.compare' : 'calc.tab.yearly')}
          </button>
        ))}
      </div>
      {mode === 'compare' ? <CompareTab /> : <YearlyTab />}
    </div>
  )
}

function CompareTab() {
  const factors = useFactors()
  const { t } = useT()
  if (factors.isPending) return <PageSkeleton />
  if (factors.isError) return <ErrorBanner message={errorMessage(factors.error, t('calc.factorsError'))} />
  return <CompareForm factors={factors.data} />
}

function CompareForm({ factors }: { factors: Factor[] }) {
  const { t } = useT()
  const available = useMemo(() => categories.filter((c) => factors.some((f) => f.category === c)), [factors])
  const [category, setCategory] = useState<Category>(available[0] ?? 'TRANSPORT')
  const options = useMemo(() => factors.filter((f) => f.category === category), [factors, category])
  const [subtype, setSubtype] = useState(options[0]?.subtype ?? '')
  const [quantity, setQuantity] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<{ data: CalculatorComparison; qty: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const factor = options.find((f) => f.subtype === subtype)
  const qty = Number(quantity)

  function changeCategory(next: Category) {
    setCategory(next)
    setSubtype(factors.find((f) => f.category === next)?.subtype ?? '')
    setPassengers(1)
    setError(null)
    setResult(null)
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setFormError(null)
    if (!factor) return
    if (quantity.trim() === '' || !Number.isFinite(qty) || qty <= 0) return setError(t('calc.amountError'))
    if (qty > factor.maxQuantity) return setError(t('calc.maxError', { max: factor.maxQuantity, unit: unitLabel(factor.unit) }))
    setError(null)
    setBusy(true)
    try {
      // Same engine as logging, but the server stores nothing for this call.
      const data = await compare({ category, subtype, quantity: qty, occurredOn: localToday(), passengers: factor.shareable ? passengers : 1 })
      setResult({ data, qty })
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : t('calc.compareError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-[2fr_3fr]">
      <Card>
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">{t('calc.category')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {available.map((c) => {
                const active = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => changeCategory(c)}
                    className={`flex min-h-[72px] flex-col items-start justify-between gap-2 rounded-2xl border p-3 text-left text-sm font-semibold text-ink transition-colors ${
                      active ? 'border-ink bg-surface ring-2 ring-ink' : 'border-line bg-raised hover:bg-fill'
                    }`}
                  >
                    <span aria-hidden className={`grid h-8 w-8 place-items-center rounded-xl ${active ? 'bg-brand text-brand-ink' : 'bg-fill text-ink'}`}>
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={categoryGlyph[c]} />
                      </svg>
                    </span>
                    {categoryLabel[c]}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <SelectField
            label={t('calc.type')}
            options={options.map((f) => ({ value: f.subtype, label: f.label }))}
            value={subtype}
            onChange={(e) => {
              setSubtype(e.target.value)
              setResult(null)
            }}
          />
          <TextField
            label={t('calc.amount', { unit: factor ? unitLabel(factor.unit) : '' })}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={error ?? undefined}
          />
          {factor?.shareable && (
            <TextField
              label={t('calc.passengers')}
              type="number"
              min={1}
              max={9}
              value={String(passengers)}
              onChange={(e) => setPassengers(Math.min(9, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              hint={t('calc.passengersHint')}
            />
          )}
          <ErrorBanner message={formError} />
          <Button type="submit" className="w-full" disabled={busy || !factor}>
            {busy ? t('calc.busy') : t('calc.submit')}
          </Button>
        </form>
      </Card>
      <div aria-live="polite">{result && <CompareResults data={result.data} qty={result.qty} />}</div>
    </div>
  )
}

/** Every option on one scale, lowest first; values are always written out, the bar only repeats them. */
export function CompareResults({ data, qty }: { data: CalculatorComparison; qty: number }) {
  const { t } = useT()
  const rows = [
    { ...data.chosen, savingKg: 0, chosen: true },
    ...data.alternatives.map((a) => ({ ...a, chosen: false })),
  ].sort((a, b) => a.kgCo2e - b.kgCo2e)
  const max = Math.max(0.001, ...rows.map((r) => r.kgCo2e))

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {t('calc.results', { qty: formatKg(qty), unit: unitLabel(data.chosen.unit) })}
      </h2>
      <ol className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.subtype}
            aria-current={r.chosen ? 'true' : undefined}
            className={`rounded-2xl px-3 py-2.5 text-sm ${r.chosen ? 'border border-ink bg-surface ring-2 ring-ink' : 'border border-transparent'}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-ink">
                {r.label}
                {r.chosen && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-ink">{t('calc.chosen')}</span>}
              </span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <span className="font-display font-semibold text-ink">
                  {formatKg(r.kgCo2e)} {t('common.kg')}
                </span>
                {!r.chosen &&
                  (r.savingKg > 0 ? (
                    <span className="brand-chip">{t('calc.saves', { kg: formatKg(r.savingKg) })}</span>
                  ) : r.savingKg < 0 ? (
                    <span className="text-xs text-muted">{t('calc.more', { kg: formatKg(-r.savingKg) })}</span>
                  ) : (
                    <span className="text-xs text-muted">{t('calc.same')}</span>
                  ))}
              </span>
            </div>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1.5 h-2.5 w-full" aria-hidden>
              <rect x="0" y="0" width="100" height="4" rx="2" className="fill-fill" />
              <rect x="0" y="0" width={Math.max(1.5, (r.kgCo2e / max) * 100)} height="4" rx="2" className={r.chosen ? 'fill-ink' : 'fill-muted'} />
            </svg>
          </li>
        ))}
      </ol>
      {data.alternatives.length === 0 && <p className="text-sm text-muted">{t('calc.none')}</p>}
    </Card>
  )
}

function YearlyTab() {
  const { state } = useAuth()
  const saved = useBaseline()
  const { t } = useT()
  const [estimate, setEstimate] = useState<Baseline | null>(null)
  if (state.status !== 'authed') return null
  if (saved.isPending) return <PageSkeleton />

  return (
    <div className="space-y-4 md:space-y-5">
      {estimate && <TargetCard tonnes={estimate.annualTonnes} />}
      <Card className="p-5 md:p-7">
        <p className="mb-5 text-sm text-muted">{t('calc.yearlyIntro')}</p>
        {/* The form's own submit is repurposed: it previews against the target and never saves. */}
        <BaselineForm
          initial={saved.data?.answers ?? emptyAnswers(state.user.profile)}
          submitLabel={t('calc.yearlySubmit')}
          onSubmit={async (answers) => {
            setEstimate(await previewBaseline(answers))
            window.scrollTo?.({ top: 0, behavior: 'smooth' })
          }}
        />
      </Card>
    </div>
  )
}

export function TargetCard({ tonnes }: { tonnes: number }) {
  const { t } = useT()
  const scale = Math.max(tonnes, TARGET_2030_T) * 1.1
  const gap = tonnes - TARGET_2030_T
  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted">{t('calc.total')}</p>
        <p className="font-display text-5xl font-semibold tabular-nums tracking-tight">
          {tonnes.toFixed(1)} <span className="font-sans text-base font-normal tracking-normal text-muted">{t('calc.perYear')}</span>
        </p>
        <p className="mt-1 text-sm font-medium">
          {gap > 0 ? t('calc.above', { t: gap.toFixed(1) }) : t('calc.below', { t: (-gap).toFixed(1) })}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={t('calc.progress')}
        aria-valuemin={0}
        aria-valuemax={Number(scale.toFixed(1))}
        aria-valuenow={Number(tonnes.toFixed(1))}
        aria-valuetext={`${tonnes.toFixed(1)} t / ${TARGET_2030_T} t`}
        className="relative h-4 rounded-full bg-fill"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${(tonnes / scale) * 100}%` }} />
        <div aria-hidden className="absolute -inset-y-1 w-1 rounded-full bg-brand ring-2 ring-ink" style={{ left: `${(TARGET_2030_T / scale) * 100}%` }} />
      </div>
      <p className="text-sm text-ink">{t('calc.target', { t: formatKg(TARGET_2030_T) })}</p>
      <p className="text-xs text-muted">{t('calc.source', { source: TARGET_SOURCE })}</p>
    </Card>
  )
}
