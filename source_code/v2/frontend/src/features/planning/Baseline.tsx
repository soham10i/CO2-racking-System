import { useState } from 'react'
import { BaselineForm, CategoryBars, emptyAnswers } from './BaselineForm'
import { useBaseline, useSaveBaseline } from './hooks'
import type { Baseline as BaselineData } from '../../api/types'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, ErrorBanner, Spinner } from '../../components/ui'
import { categoryLabel, formatKg, shortDate } from '../../lib/format'

export default function Baseline() {
  const { state } = useAuth()
  const baseline = useBaseline()
  const save = useSaveBaseline()
  const [editing, setEditing] = useState(false)

  if (state.status !== 'authed') return null
  if (baseline.isPending) return <Spinner />
  if (baseline.isError) return <ErrorBanner message={errorMessage(baseline.error, 'Could not load your baseline')} />
  const data = baseline.data
  const showForm = editing || !data

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your annual baseline</h1>
          <p className="text-muted">A quick estimate of a typical year, before you log anything. Answer roughly — it takes about five minutes.</p>
        </div>
        {data && !editing && <Button variant="secondary" onClick={() => setEditing(true)}>Update answers</Button>}
      </header>

      {showForm ? (
        <Card>
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
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card className="space-y-4">
        <div>
          <p className="text-sm text-muted">Estimated footprint</p>
          <p className="text-4xl font-bold tabular-nums">
            {data.annualTonnes.toFixed(1)} <span className="text-lg font-normal text-muted">t CO2e a year</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            The 1.5 °C lifestyle target for 2030 is 2.5 t a year. Factors as of {shortDate(data.factorsOn)}
            {data.savedAt ? `, saved ${shortDate(data.savedAt.slice(0, 10))}` : ''}.
          </p>
        </div>
        <CategoryBars rows={data.byCategory} />
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">How it adds up</h2>
        <ul className="divide-y divide-line">
          {[...data.items]
            .sort((a, b) => b.annualKg - a.annualKg)
            .map((i) => (
              <li key={`${i.category}-${i.label}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{i.label}</span>
                  <span className="text-muted"> · {categoryLabel[i.category]}</span>
                  <span className="block text-xs text-muted">{i.basis}</span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold">{formatKg(i.annualKg)} kg</span>
              </li>
            ))}
        </ul>
        {data.assumptions.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Assumptions</summary>
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
