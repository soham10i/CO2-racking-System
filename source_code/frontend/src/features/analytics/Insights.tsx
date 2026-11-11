import { useMemo, useState } from 'react'
import { CalendarHeatmap } from './CalendarHeatmap'
import { Scope2Card } from './Scope2Card'
import { Link } from 'react-router-dom'
import type { Category, Granularity } from '../../api/types'
import { useBenchmarks, useComparison, useTrend } from './hooks'
import { ActionsCard, BaselineSummaryCard } from '../planning/ActionsCard'
import { daysBetween, presetRange, presets, previousRange, shareRows, toTrendRows, trendSentence, type Preset, type Range } from './series'
import { errorMessage } from '../../app/queryClient'
import { BenchmarkChart, BreakdownChart, CompareChart } from '../../components/charts/BarCharts'
import { ChartCard, Legend } from '../../components/charts/ChartCard'
import { TrendChart } from '../../components/charts/TrendChart'
import { useChartColors } from '../../components/charts/useChartColors'
import { ButtonLink, Card, ErrorBanner, Loading, SelectField, SkeletonCard, TextField } from '../../components/ui'
import { categories, categoryLabel, formatChange, formatKg, localToday, shortDate } from '../../lib/format'

/** Axis labels for narrow category charts; tooltips and tables use the full names. */
const shortCategory: Record<Category, string> = { TRANSPORT: 'Travel', ENERGY: 'Energy', DIET: 'Food', SHOPPING: 'Goods', WASTE: 'Waste' }

/** Coarsest bucket that still gives a readable number of points; DAY is capped server-side at 366 days. */
function autoGranularity(days: number): Granularity {
  if (days <= 62) return 'DAY'
  if (days <= 366) return 'WEEK'
  return 'MONTH'
}

const pill = (active: boolean) =>
  `min-h-[40px] rounded-full border px-4 text-sm font-semibold tracking-tight transition-colors ${active ? 'border-transparent bg-primary text-primary-ink' : 'border-line bg-surface text-ink hover:bg-fill'}`

/** Decorative delta badge (the figure beside it carries the value): up is worse (more emissions), down is better. Shape and sign carry meaning, not colour alone. */
function DeltaPill({ pct }: { pct: number | null | undefined }) {
  const tone =
    pct === null || pct === undefined || pct === 0
      ? 'bg-fill text-ink'
      : pct < 0
        ? 'bg-brand text-brand-ink'
        : 'bg-fill-strong text-ink'
  return (
    <span aria-hidden className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${tone}`}>
      {pct !== null && pct !== undefined && pct !== 0 && (
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={pct < 0 ? 'rotate-180' : ''}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      )}
      {(pct === null || pct === undefined || pct === 0) && <span className="h-0.5 w-2.5 rounded-full bg-current" />}
    </span>
  )
}

export default function Insights() {
  const today = localToday()
  const [preset, setPreset] = useState<Preset | 'custom'>('30d')
  const [custom, setCustom] = useState<Range>(() => presetRange('30d', today))
  const [compare, setCompare] = useState(true)
  const [mode, setMode] = useState<'total' | 'category'>('total')
  const [hidden, setHidden] = useState<Category[]>([])
  const colors = useChartColors()

  const range = preset === 'custom' ? custom : presetRange(preset, today)
  const rangeError =
    range.from > range.to
      ? 'The start date must be on or before the end date.'
      : range.granularity === 'DAY' && daysBetween(range.from, range.to) > 366
        ? 'Daily view covers at most a year; choose weekly or monthly.'
        : null
  const prev = previousRange(range.from, range.to)

  const trend = useTrend(range, !rangeError)
  const previous = useTrend({ ...prev, granularity: range.granularity }, !rangeError && compare && mode === 'total')
  const comparison = useComparison(rangeError ? {} : { from: range.from, to: range.to })
  const benchmarks = useBenchmarks()

  const rows = useMemo(
    () => (trend.data ? toTrendRows(trend.data, compare && mode === 'total' ? previous.data : undefined) : []),
    [trend.data, previous.data, compare, mode],
  )
  const visible = categories.filter((c) => !hidden.includes(c))
  const toggleCategory = (c: Category) =>
    setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))

  const cmp = comparison.data
  const compareRows = cmp
    ? categories.map((c) => {
        const r = cmp.categories.find((x) => x.category === c)
        return { label: categoryLabel[c], short: shortCategory[c], current: r?.current ?? 0, previous: r?.previous ?? 0, changePct: r?.changePct }
      })
    : []
  const shares = cmp ? shareRows(cmp.current.byCategory) : []

  const bm = benchmarks.data
  const benchRows = bm
    ? [
        ...(bm.annualTonnes !== undefined ? [{ label: 'You (annualised)', tonnes: bm.annualTonnes, you: true }] : []),
        ...bm.references.map((r) => ({ label: r.label, tonnes: r.tonnesPerYear })),
      ]
    : []

  const error = trend.error ?? comparison.error ?? benchmarks.error

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Insights</h1>
          <p className="mt-1.5 max-w-2xl text-muted">
            Track your trend, compare periods and see where your emissions come from.{' '}
            <Link to="/methodology" className="font-medium text-accent underline">
              How the numbers are calculated
            </Link>
          </p>
        </div>
        <ButtonLink to="/review" variant="secondary">Year in review</ButtonLink>
      </header>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Time range" className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.value} type="button" aria-pressed={preset === p.value} className={pill(preset === p.value)} onClick={() => setPreset(p.value)}>
              {p.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={preset === 'custom'}
            className={pill(preset === 'custom')}
            onClick={() => {
              setCustom(range)
              setPreset('custom')
            }}
          >
            Custom
          </button>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted tabular-nums">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          {shortDate(range.from)} – {shortDate(range.to)} · compared with {shortDate(prev.from)} – {shortDate(prev.to)}
        </p>
        </div>
        {preset === 'custom' && (
          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
            <TextField
              label="From"
              type="date"
              value={custom.from}
              max={today}
              onChange={(e) => {
                const from = e.target.value
                if (from) setCustom((c) => ({ ...c, from, granularity: autoGranularity(daysBetween(from, c.to)) }))
              }}
            />
            <TextField
              label="To"
              type="date"
              value={custom.to}
              max={today}
              onChange={(e) => {
                const to = e.target.value
                if (to) setCustom((c) => ({ ...c, to, granularity: autoGranularity(daysBetween(c.from, to)) }))
              }}
            />
            <SelectField
              label="Group by"
              value={custom.granularity}
              onChange={(e) => setCustom((c) => ({ ...c, granularity: e.target.value as Granularity }))}
              options={[
                { value: 'DAY', label: 'Day' },
                { value: 'WEEK', label: 'Week' },
                { value: 'MONTH', label: 'Month' },
              ]}
            />
          </div>
        )}
      </Card>

      <ErrorBanner message={rangeError ?? (error ? errorMessage(error, 'Could not load insights') : null)} />
      {trend.isPending && !rangeError && (
        <Loading label="Loading insights" className="grid gap-4 md:gap-5 lg:grid-cols-2">
          <SkeletonCard height="h-64" className="lg:col-span-2" />
          <SkeletonCard />
          <SkeletonCard />
        </Loading>
      )}

      {cmp && (
        <section aria-label="Period totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
          <div className="flex min-h-[148px] flex-col justify-between rounded-card bg-brand p-5 text-brand-ink md:p-6">
            <p className="text-sm font-medium">This period</p>
            <p className="mt-3 font-display text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">
              {formatKg(cmp.current.total)} <span className="text-base font-medium">kg</span>
            </p>
          </div>
          <Card className="flex min-h-[148px] flex-col justify-between p-5 md:p-6">
            <p className="text-sm font-medium text-muted">Previous period</p>
            <p className="mt-3 font-display text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">
              {formatKg(cmp.previous.total)} <span className="text-base font-medium text-muted">kg</span>
            </p>
          </Card>
          <Card className="flex min-h-[148px] flex-col justify-between p-5 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted">Change</p>
              <DeltaPill pct={cmp.changePct} />
            </div>
            <div>
              <p className="mt-3 font-display text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">{formatChange(cmp.changePct)}</p>
              <p className="mt-1 text-xs text-muted">(current − previous) ÷ previous</p>
            </div>
          </Card>
        </section>
      )}

      {trend.data && (
        <ChartCard
          figure
          title="Trend"
          summary={trendSentence(rows)}
          actions={
            <div role="group" aria-label="Trend lines" className="segmented">
              {(['total', 'category'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className="segment"
                >
                  {m === 'total' ? 'Total' : 'By category'}
                </button>
              ))}
            </div>
          }
          table={{
            columns:
              mode === 'total'
                ? ['Period', 'kg CO2e', ...(rows.some((r) => r.previous !== undefined) ? ['Previous'] : [])]
                : ['Period', ...categories.map((c) => categoryLabel[c])],
            rows: rows.map((r) =>
              mode === 'total'
                ? [r.label, formatKg(r.total), ...(r.previous !== undefined ? [formatKg(r.previous)] : [])]
                : [r.label, ...categories.map((c) => formatKg(r[c]))],
            ),
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {mode === 'total' ? (
              <>
                <Legend
                  items={[
                    { label: 'This period', color: colors.series },
                    ...(compare ? [{ label: 'Previous period', color: colors.neutral, dashed: true }] : []),
                  ]}
                />
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-full border border-line px-3.5 text-sm font-medium hover:bg-fill">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  Overlay previous period
                </label>
              </>
            ) : (
              <div role="group" aria-label="Categories shown" className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = !hidden.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCategory(c)}
                      className={`flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-colors ${on ? 'border-ink bg-surface text-ink' : 'border-line text-muted line-through hover:bg-fill'}`}
                    >
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: on ? colors.category[c] : colors.neutral }} />
                      {categoryLabel[c]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <TrendChart rows={rows} mode={mode} visible={visible} />
        </ChartCard>
      )}

      {cmp && (
        <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
          <ChartCard
            title="This period vs previous"
            summary={`Total ${formatKg(cmp.current.total)} kg vs ${formatKg(cmp.previous.total)} kg (${formatChange(cmp.changePct)}).`}
            table={{
              columns: ['Category', 'This period', 'Previous', 'Change'],
              rows: compareRows.map((r) => [r.label, formatKg(r.current), formatKg(r.previous), formatChange(r.changePct)]),
            }}
          >
            <Legend
              items={[
                { label: 'Previous period', color: colors.neutral },
                { label: 'This period', color: colors.series },
              ]}
            />
            <CompareChart rows={compareRows} />
          </ChartCard>

          <ChartCard
            title="Where it comes from"
            summary={
              cmp.current.total === 0
                ? 'Nothing logged in this period.'
                : `${shares[0]!.label} is the largest share at ${Math.round(shares[0]!.share)}%.`
            }
            table={{
              columns: ['Category', 'kg CO2e', 'Share'],
              rows: shares.map((r) => [r.label, formatKg(r.kg), `${Math.round(r.share)}%`]),
            }}
          >
            {cmp.current.total === 0 ? (
              <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">Nothing logged in this period.</p>
            ) : (
              <BreakdownChart rows={shares} />
            )}
          </ChartCard>
        </div>
      )}

      {bm && (
        <ChartCard
          title="Annual footprint vs references"
          summary={
            bm.annualTonnes === undefined
              ? `Log at least ${bm.minDays} days of activity to see an annualised estimate.`
              : `At your current rate you would emit about ${bm.annualTonnes.toFixed(1)} t CO2e a year from the activities you track.`
          }
          table={{
            columns: ['Reference', 't CO2e / year', 'Source'],
            rows: [
              ...(bm.annualTonnes !== undefined ? [['You (annualised)', bm.annualTonnes.toFixed(2), `${bm.days} days logged`]] : []),
              ...bm.references.map((r) => [r.label, r.tonnesPerYear.toFixed(1), r.source]),
            ],
          }}
        >
          <BenchmarkChart rows={benchRows} />
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Annualised = kg in the last {bm.days} logged days ÷ {bm.days} × 365 ÷ 1000. References are whole-life per-person
            footprints (including public services and goods you do not log), so your tracked figure is a lower bound.
          </p>
        </ChartCard>
      )}

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[3fr_2fr]">
        <ActionsCard />
        <BaselineSummaryCard />
      </div>
      {!rangeError && <Scope2Card from={range.from} to={range.to} />}
      <CalendarHeatmap />
    </div>
  )
}
