import { useState, type FormEvent } from 'react'
import type { BudgetStatus, Goal } from '../../api/types'
import { useGoal, useSetGoal } from './hooks'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, ErrorBanner, TextField } from '../../components/ui'
import { formatKg } from '../../lib/format'

const statusText: Record<BudgetStatus, { label: string; tone: string; stroke: string; icon: string }> = {
  ON_TRACK: { label: 'On track', tone: 'text-primary', stroke: 'stroke-primary', icon: 'M5 12.5 10 17l9-10' },
  AT_RISK: { label: 'At risk', tone: 'text-warn', stroke: 'stroke-warn', icon: 'M12 8v5m0 3h.01M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z' },
  OVER: { label: 'Over budget', tone: 'text-danger', stroke: 'stroke-danger', icon: 'M12 7v6m0 4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
}

const R = 42
const C = 2 * Math.PI * R

/** A progress ring: month-to-date against the budget, with a tick where the month-end projection lands. */
function Ring({ goal }: { goal: Goal }) {
  const used = goal.monthlyBudgetKg > 0 ? goal.monthToDateKg / goal.monthlyBudgetKg : 0
  const projected = goal.monthlyBudgetKg > 0 ? Math.min(goal.projectedKg / goal.monthlyBudgetKg, 1) : 0
  const angle = projected * 2 * Math.PI - Math.PI / 2
  const s = statusText[goal.status]
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="10" className="stroke-[var(--fill-strong)]" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(used, 1) * C} ${C}`}
          transform="rotate(-90 50 50)"
          className={`${s.stroke} transition-[stroke-dasharray] duration-500`}
        />
        {goal.projectedKg > goal.monthToDateKg && (
          <line
            x1={50 + (R - 8) * Math.cos(angle)}
            y1={50 + (R - 8) * Math.sin(angle)}
            x2={50 + (R + 8) * Math.cos(angle)}
            y2={50 + (R + 8) * Math.sin(angle)}
            strokeWidth="2.5"
            strokeLinecap="round"
            className="stroke-[var(--ink)]"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <p className="leading-tight">
          <span className="block text-xl font-semibold tabular-nums">{Math.round(used * 100)}%</span>
          <span className="text-xs text-muted">used</span>
        </p>
      </div>
    </div>
  )
}

export function BudgetCard() {
  const goal = useGoal()
  const save = useSetGoal()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const g = goal.data

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(value)
    if (value.trim() === '' || !Number.isFinite(n) || n < 1) return setError('Enter a budget of at least 1 kg')
    setError(null)
    try {
      await save.mutateAsync(Math.round(n * 10) / 10)
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not save the budget'))
    }
  }

  async function reset() {
    setError(null)
    try {
      await save.mutateAsync(null)
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the budget'))
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Monthly budget</h2>
        {g && !editing && (
          <button
            type="button"
            className="text-sm font-medium text-accent underline"
            onClick={() => {
              setValue(String(g.monthlyBudgetKg))
              setEditing(true)
            }}
          >
            Edit
          </button>
        )}
      </div>
      <ErrorBanner message={goal.isError ? errorMessage(goal.error, 'Could not load the budget') : error} />
      {g && !editing && (
        <div className="flex items-center gap-4">
          <Ring goal={g} />
          <div className="min-w-0 space-y-1 text-sm">
            <p className={`flex items-center gap-1.5 font-semibold ${statusText[g.status].tone}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={statusText[g.status].icon} />
              </svg>
              {statusText[g.status].label}
            </p>
            <p>
              <span className="font-semibold tabular-nums">{formatKg(g.monthToDateKg)}</span> of{' '}
              <span className="tabular-nums">{formatKg(g.monthlyBudgetKg)}</span> kg CO2e
            </p>
            <p className="text-muted">
              Heading for <span className="tabular-nums">{formatKg(g.projectedKg)}</span> kg by month end · day {g.daysElapsed} of{' '}
              {g.daysInMonth}
            </p>
            <p className="text-xs text-muted">{g.defaultBudget ? `Default: ${g.basis}` : g.basis}</p>
          </div>
        </div>
      )}
      {editing && g && (
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
          <TextField
            label="Budget per month (kg CO2e)"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            hint="The default is the 1.5 °C lifestyle target for 2030, divided by 12."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {!g.defaultBudget && (
              <Button type="button" variant="secondary" onClick={() => void reset()} disabled={save.isPending}>
                Use default
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  )
}
