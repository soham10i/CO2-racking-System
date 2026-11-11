import { useState, type FormEvent } from 'react'
import type { BudgetStatus, Goal } from '../../api/types'
import { useGoal, useSetGoal } from './hooks'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, ErrorBanner, TextField } from '../../components/ui'
import { formatKg } from '../../lib/format'
import { useMounted } from '../../lib/motion'
import { CountUp } from '../../components/CountUp'

const statusText: Record<BudgetStatus, { label: string; tone: string; stroke: string; icon: string }> = {
  ON_TRACK: { label: 'On track', tone: 'text-ink', stroke: 'stroke-[var(--brand-ink)]', icon: 'M5 12.5 10 17l9-10' },
  AT_RISK: { label: 'At risk', tone: 'text-warn', stroke: 'stroke-[var(--warn)]', icon: 'M12 8v5m0 3h.01M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z' },
  OVER: { label: 'Over budget', tone: 'text-danger', stroke: 'stroke-[var(--danger)]', icon: 'M12 7v6m0 4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
}

const R = 42
const C = 2 * Math.PI * R

/** A progress ring: month-to-date against the budget, with a tick where the month-end projection lands. */
function Ring({ goal }: { goal: Goal }) {
  const used = goal.monthlyBudgetKg > 0 ? goal.monthToDateKg / goal.monthlyBudgetKg : 0
  const projected = goal.monthlyBudgetKg > 0 ? Math.min(goal.projectedKg / goal.monthlyBudgetKg, 1) : 0
  const angle = projected * 2 * Math.PI - Math.PI / 2
  const s = statusText[goal.status]
  const mounted = useMounted()
  // Lime disc only when on track: warn/danger strokes fail 3:1 on lime in dark mode.
  const lime = goal.status === 'ON_TRACK'
  return (
    <div className="relative h-36 w-36 shrink-0 md:h-40 md:w-40">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r={R + 6} className={lime ? 'fill-[var(--brand)]' : 'fill-[var(--fill)]'} />
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeOpacity="0.15" className={lime ? 'stroke-[var(--brand-ink)]' : 'stroke-[var(--ink)]'} />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${mounted ? Math.min(used, 1) * C : 0} ${C}`}
          transform="rotate(-90 50 50)"
          className={`${s.stroke} transition-[stroke-dasharray] duration-700 ease-out`}
        />
        {goal.projectedKg > goal.monthToDateKg && (
          <line
            x1={50 + (R - 8) * Math.cos(angle)}
            y1={50 + (R - 8) * Math.sin(angle)}
            x2={50 + (R + 8) * Math.cos(angle)}
            y2={50 + (R + 8) * Math.sin(angle)}
            strokeWidth="2.5"
            strokeLinecap="round"
            className={lime ? 'stroke-[var(--brand-ink)]' : 'stroke-[var(--ink)]'}
          />
        )}
      </svg>
      <div className="absolute inset-[18%] grid place-items-center rounded-full bg-surface text-center">
        <p className="leading-tight">
          <span className="block font-display text-3xl font-semibold tabular-nums tracking-tight">
            <CountUp value={used * 100} format={(n) => `${Math.round(n)}%`} />
          </span>
          <span className="text-xs font-medium text-muted">used</span>
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
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">Monthly budget</h2>
        {g && !editing && (
          <button
            type="button"
            className="liquid-capsule min-h-[36px] rounded-full px-4 text-sm font-medium text-ink"
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
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <Ring goal={g} />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p className={`inline-flex items-center gap-1.5 rounded-full border border-current px-3 py-1 font-semibold ${statusText[g.status].tone}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={statusText[g.status].icon} />
              </svg>
              {statusText[g.status].label}
            </p>
            <p>
              <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">{formatKg(g.monthToDateKg)}</span> of{' '}
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
        <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
          <TextField
            label="Budget per month (kg CO2e)"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            hint="The default is the 1.5 °C lifestyle target for 2030, divided by 12."
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={save.isPending} className="w-full sm:order-last sm:w-auto">
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
