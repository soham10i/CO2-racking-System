import { useState } from 'react'
import { BaselineForm, CategoryBars, emptyAnswers } from './BaselineForm'
import { useBaseline, useSaveBaseline } from './hooks'
import type { Baseline as BaselineData } from '../../api/types'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, ErrorBanner, PageSkeleton } from '../../components/ui'
import { categoryLabel, formatKg, shortDate } from '../../lib/format'

export default function Baseline() {
  const { state } = useAuth()
  const baseline = useBaseline()
  const save = useSaveBaseline()
  const [editing, setEditing] = useState(false)

  if (state.status !== 'authed') return null
  if (baseline.isPending) return <PageSkeleton />
  if (baseline.isError) return <ErrorBanner message={errorMessage(baseline.error, 'Could not load your baseline')} />
  const data = baseline.data
  const showForm = editing || !data

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Your annual baseline</h1>
          <p className="text-muted">A quick estimate of a typical year, before you log anything. Answer roughly — it takes about five minutes.</p>
        </div>
        {data && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>Update answers</Button>}
      </header>

      {showForm ? (
        <Card className="p-5 md:p-7">
          <BaselineForm
            initial={data?.answers ?? emptyAnswers(state.user.profile)}
            submitLabel="Save baseline"
            onSubmit={async (answers) => {
              await save.mutateAsync(answers)
              setEditing(false)
            }}
            {...(data ? { secondary: <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button> } : {})}
          />
        </Card>
      ) : (
        <BaselineResult data={data} />
      )}
    </div>
  )
}

export function BaselineResult({ data }: { data: BaselineData }) {
  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-[2fr_3fr]">
      <div className="space-y-4 md:space-y-5">
      <section className="rounded-card bg-brand p-6 text-brand-ink">
          <p className="text-sm font-medium">Estimated footprint</p>
          <p className="mt-2 font-display text-5xl font-semibold tracking-tight tabular-nums md:text-6xl">
            {data.annualTonnes.toFixed(1)} <span className="font-sans text-lg font-medium">t CO2e a year</span>
          </p>
          <p className="mt-3 text-sm">
            The 1.5 °C lifestyle target for 2030 is 2.5 t a year. Factors as of {shortDate(data.factorsOn)}
            {data.savedAt ? `, saved ${shortDate(data.savedAt.slice(0, 10))}` : ''}.
          </p>
      </section>
      <Card className="p-6">
        <CategoryBars rows={data.byCategory} />
      </Card>
      </div>
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight">How it adds up</h2>
        <ul className="divide-y divide-line">
          {[...data.items]
            .sort((a, b) => b.annualKg - a.annualKg)
            .map((i) => (
              <li key={`${i.category}-${i.label}`} className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3 text-sm transition-colors hover:bg-fill">
                <span>
                  <span className="font-medium">{i.label}</span>
                  <span className="text-muted"> · {categoryLabel[i.category]}</span>
                  <span className="block text-xs text-muted">{i.basis}</span>
                </span>
                <span className="shrink-0 text-right font-display font-semibold tabular-nums">{formatKg(i.annualKg)} kg</span>
              </li>
            ))}
        </ul>
        {data.assumptions.length > 0 && (
          <details className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink">Assumptions</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {data.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  )
}
