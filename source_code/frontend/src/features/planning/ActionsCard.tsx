import { Link } from 'react-router-dom'
import { CategoryBars } from './BaselineForm'
import { useActions, useBaseline, useDecideAction } from './hooks'
import { CategoryTile } from '../activities/ActivityRow'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, ErrorBanner, Loading, SkeletonRows } from '../../components/ui'
import { useToast } from '../../components/Toast'
import type { DecisionStatus } from '../../api/types'
import { formatKg, shortDate } from '../../lib/format'

/** What-if swaps, sized from the user's own recent entries, plus the ones the user has taken on. */
export function ActionsCard() {
  const actions = useActions()
  const decide = useDecideAction()
  const toast = useToast()
  const a = actions.data

  async function act(key: string, title: string, status: DecisionStatus, snoozeDays?: number) {
    try {
      await decide.mutateAsync({ key, status, snoozeDays })
      const verb = status === 'ADOPTED' ? 'Committed to' : status === 'DISMISSED' ? 'Hid' : `Snoozed for ${snoozeDays} days:`
      toast({
        message: `${verb} “${title}”`,
        action: { label: 'Undo', run: () => void decide.mutateAsync({ key }).catch(() => toast({ message: 'Could not undo', tone: 'error' })) },
      })
    } catch (e) {
      toast({ message: errorMessage(e, 'Could not save that choice') ?? 'Could not save that choice', tone: 'error' })
    }
  }

  async function restore(key: string) {
    try {
      await decide.mutateAsync({ key })
    } catch (e) {
      toast({ message: errorMessage(e, 'Could not restore it') ?? 'Could not restore it', tone: 'error' })
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">What if you…</h2>
        {a && (
          <p className="text-sm text-muted">
            Based on your entries from {shortDate(a.from)} to {shortDate(a.to)} ({a.windowDays} days), scaled to a year.
          </p>
        )}
      </div>
      {actions.isPending && <Loading label="Loading suggestions"><SkeletonRows rows={3} /></Loading>}
      <ErrorBanner message={actions.isError ? errorMessage(actions.error, 'Could not load suggestions') : null} />
      {a && a.actions.length === 0 && (
        <p className="text-sm text-muted">
          {a.commitments.length || a.hidden.length
            ? 'No new suggestions right now. Keep logging and new ones appear when there is something to swap.'
            : 'Keep logging trips, meals and energy for a week or two — suggestions appear once there is something to swap.'}
        </p>
      )}
      {a && a.actions.length > 0 && (
        <ul className="-mx-2 divide-y divide-line">
          {a.actions.map((x) => (
            <li key={x.key} className="flex items-start gap-3 rounded-2xl px-2 py-4 transition hover:bg-fill">
              <CategoryTile category={x.category} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium leading-snug">{x.title}</p>
                  <p className="shrink-0 text-right tabular-nums">
                    <span className="inline-block rounded-full bg-brand px-2.5 py-0.5 font-display text-base font-semibold tracking-tight text-brand-ink">−{formatKg(x.annualSavingKg)}</span>
                    <span className="mt-0.5 block text-xs text-muted">kg a year</span>
                  </p>
                </div>
                <p className="text-sm text-muted">{x.description}</p>
                <p className="mt-0.5 text-xs text-muted">{x.basis}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="px-3" disabled={decide.isPending} onClick={() => act(x.key, x.title, 'ADOPTED')}>
                    I’ll do this
                  </Button>
                  <Button variant="secondary" className="px-3" disabled={decide.isPending} onClick={() => act(x.key, x.title, 'SNOOZED', 30)}>
                    Later
                  </Button>
                  <Button variant="ghost" className="px-3" disabled={decide.isPending} onClick={() => act(x.key, x.title, 'DISMISSED')}>
                    Not for me
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {a && a.commitments.length > 0 && (
        <section aria-labelledby="commitments-h" className="border-t border-line pt-4">
          <h3 id="commitments-h" className="font-display font-semibold tracking-tight">Your commitments</h3>
          <ul className="divide-y divide-line">
            {a.commitments.map((c) => (
              <li key={c.key} className="flex items-start gap-3 py-3">
                <CategoryTile category={c.category} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{c.title}</p>
                  <p className="text-xs text-muted">
                    Since {shortDate(c.adoptedOn)} · {c.basis}
                  </p>
                  <button type="button" className="mt-1 text-xs font-medium text-accent underline" onClick={() => restore(c.key)}>
                    Stop tracking
                  </button>
                </div>
                <dl className="shrink-0 text-right text-sm tabular-nums">
                  <dt className="sr-only">Expected saving</dt>
                  <dd className="text-muted">expected −{formatKg(c.expectedAnnualKg)}</dd>
                  <dt className="sr-only">Measured saving</dt>
                  <dd className="font-display font-semibold">
                    {c.realisedAnnualKg === undefined
                      ? 'Measuring…'
                      : `${c.realisedAnnualKg >= 0 ? '−' : '+'}${formatKg(Math.abs(c.realisedAnnualKg))} so far`}
                  </dd>
                  <dd className="text-xs text-muted">kg a year</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a && a.hidden.length > 0 && (
        <details className="border-t border-line pt-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Hidden suggestions ({a.hidden.length})</summary>
          <ul className="mt-2 space-y-2">
            {a.hidden.map((h) => (
              <li key={h.key} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  {h.title}
                  <span className="block text-xs text-muted">
                    {h.status === 'SNOOZED' && h.snoozedUntil ? `Snoozed until ${shortDate(h.snoozedUntil)}` : 'Not for me'}
                  </span>
                </span>
                <button type="button" className="shrink-0 font-medium text-accent underline" onClick={() => restore(h.key)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
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
        <h2 className="font-display text-lg font-semibold tracking-tight">Your annual baseline</h2>
        <Link to="/baseline" className="text-sm font-medium text-accent underline">
          {b ? 'Details' : 'Start'}
        </Link>
      </div>
      {baseline.isPending && <Loading label="Loading baseline"><SkeletonRows rows={2} /></Loading>}
      {b === null && (
        <p className="text-sm text-muted">
          Answer a few questions about a typical year — travel, home, food, shopping — to see your whole footprint, not just
          what you log.
        </p>
      )}
      {b && (
        <>
          <p className="font-display text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">
            {b.annualTonnes.toFixed(1)} <span className="font-sans text-base font-normal tracking-normal text-muted">t CO2e a year (estimate)</span>
          </p>
          <CategoryBars rows={b.byCategory} />
        </>
      )}
    </Card>
  )
}
