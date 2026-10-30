import { Link } from 'react-router-dom'
import { CategoryBars } from './BaselineForm'
import { useActions, useBaseline } from './hooks'
import { CategoryTile } from '../activities/ActivityRow'
import { errorMessage } from '../../app/queryClient'
import { Card, ErrorBanner, Spinner } from '../../components/ui'
import { formatKg, shortDate } from '../../lib/format'

/** What-if swaps, sized from the user's own recent entries. */
export function ActionsCard() {
  const actions = useActions()
  const a = actions.data
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">What if you…</h2>
        {a && (
          <p className="text-sm text-muted">
            Based on your entries from {shortDate(a.from)} to {shortDate(a.to)} ({a.windowDays} days), scaled to a year.
          </p>
        )}
      </div>
      {actions.isPending && <Spinner />}
      <ErrorBanner message={actions.isError ? errorMessage(actions.error, 'Could not load suggestions') : null} />
      {a && a.actions.length === 0 && (
        <p className="text-sm text-muted">
          Keep logging trips, meals and energy for a week or two — suggestions appear once there is something to swap.
        </p>
      )}
      {a && a.actions.length > 0 && (
        <ul className="divide-y divide-line">
          {a.actions.map((x) => (
            <li key={x.key} className="flex items-start gap-3 py-3">
              <CategoryTile category={x.category} />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{x.title}</p>
                <p className="text-sm text-muted">{x.description}</p>
                <p className="mt-0.5 text-xs text-muted">{x.basis}</p>
              </div>
              <p className="shrink-0 text-right tabular-nums">
                <span className="font-semibold text-primary">−{formatKg(x.annualSavingKg)}</span>
                <span className="block text-xs text-muted">kg a year</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** The saved questionnaire estimate, or an invitation to fill it in. */
export function BaselineSummaryCard() {
  const baseline = useBaseline()
  const b = baseline.data
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Your annual baseline</h2>
        <Link to="/baseline" className="text-sm font-medium text-accent underline">
          {b ? 'Details' : 'Start'}
        </Link>
      </div>
      {baseline.isPending && <Spinner />}
      {b === null && (
        <p className="text-sm text-muted">
          Answer a few questions about a typical year — travel, home, food, shopping — to see your whole footprint, not just
          what you log.
        </p>
      )}
      {b && (
        <>
          <p className="text-3xl font-bold tabular-nums">
            {b.annualTonnes.toFixed(1)} <span className="text-base font-normal text-muted">t CO2e a year (estimate)</span>
          </p>
          <CategoryBars rows={b.byCategory} />
        </>
      )}
    </Card>
  )
}
