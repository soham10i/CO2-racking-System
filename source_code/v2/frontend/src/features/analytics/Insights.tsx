import { useMemo, useState } from 'react'
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
import { Card, ErrorBanner, SelectField, Spinner, TextField } from '../../components/ui'
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
  `min-h-[36px] rounded-full px-4 text-sm font-medium transition ${active ? 'bg-primary text-primary-ink shadow-sm' : 'bg-fill text-ink hover:bg-fill-strong'}`

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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted">
          Track your trend, compare periods and see where your emissions come from.{' '}
          <Link to="/methodology" className="font-medium text-accent underline">
            How the numbers are calculated
          </Link>
        </p>
      </header>

      <Card className="space-y-3">
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
        {preset === 'custom' && (
          <div className="grid gap-3 sm:grid-cols-3">
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
        <p className="text-sm text-muted">
          {shortDate(range.from)} – {shortDate(range.to)} · compared with {shortDate(prev.from)} – {shortDate(prev.to)}
        </p>
      </Card>

      <ErrorBanner message={rangeError ?? (error ? errorMessage(error, 'Could not load insights') : null)} />
      {trend.isPending && !rangeError && <Spinner />}

      {cmp && (
        <section aria-label="Period totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-muted">This period</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatKg(cmp.current.total)} <span className="text-sm font-normal text-muted">kg</span></p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Previous period</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatKg(cmp.previous.total)} <span className="text-sm font-normal text-muted">kg</span></p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Change</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatChange(cmp.changePct)}</p>
            <p className="text-xs text-muted">(current − previous) ÷ previous</p>
          </Card>
        </section>
      )}

      {trend.data && (
        <ChartCard
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            {mode === 'total' ? (
              <>
                <Legend
                  items={[
                    { label: 'This period', color: colors.series },
                    ...(compare ? [{ label: 'Previous period', color: colors.neutral, dashed: true }] : []),
                  ]}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4" />
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
                      className={`flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-xs font-medium ${on ? 'bg-fill text-ink' : 'text-muted line-through'}`}
                    >
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: on ? colors.category[c] : colors.neutral }} />
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
        <div className="grid gap-6 lg:grid-cols-2">
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
              <p className="py-8 text-center text-sm text-muted">Nothing logged in this period.</p>
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
          <p className="mt-2 text-xs text-muted">
            Annualised = kg in the last {bm.days} logged days ÷ {bm.days} × 365 ÷ 1000. References are whole-life per-person
            footprints (including public services and goods you do not log), so your tracked figure is a lower bound.
          </p>
        </ChartCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <ActionsCard />
        <BaselineSummaryCard />
      </div>
    </div>
  )
}
