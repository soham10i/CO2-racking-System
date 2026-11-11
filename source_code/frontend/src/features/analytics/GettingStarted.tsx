import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBaseline, useGoal, useTemplates } from '../planning/hooks'
import { useSummary } from './hooks'
import { Card } from '../../components/ui'
import { useT } from '../../lib/i18n'

const storageKey = (userId: string) => `co2.gettingStarted.dismissed.${userId}`

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === '1'
  } catch {
    return false
  }
}

/**
 * A short first-week checklist on the dashboard. Each step is ticked from what the API already knows, so it
 * stays right across devices; only "hide this" is remembered locally, per user.
 */
export function GettingStarted({ userId }: { userId: string }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(userId))
  const { t } = useT()
  const summary = useSummary()
  const baseline = useBaseline()
  const templates = useTemplates()
  const goal = useGoal()
  if (dismissed || !summary.data || baseline.isPending || !templates.data || !goal.data) return null

  const steps = [
    { done: true, label: t('gs.profile'), to: '/settings' },
    { done: summary.data.year > 0, label: t('gs.first'), to: '/log/new' },
    { done: baseline.data != null, label: t('gs.baseline'), to: '/baseline' },
    { done: !goal.data.defaultBudget, label: t('gs.budget'), to: '/baseline' },
    { done: templates.data.length > 0, label: t('gs.template'), to: '/templates' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  function dismiss() {
    try {
      localStorage.setItem(storageKey(userId), '1')
    } catch {
      // Private mode: the card simply comes back next visit.
    }
    setDismissed(true)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">{t('gs.title')}</h2>
          <p className="mt-0.5 text-sm text-muted tabular-nums">
            {t('gs.progress', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button type="button" onClick={dismiss} className="liquid-capsule min-h-[36px] shrink-0 rounded-full px-4 text-sm font-medium text-ink">
          {t('gs.hide')}
        </button>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fill-strong" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-3 py-2.5 transition hover:bg-fill ${
                s.done ? 'border-line text-muted' : 'border-line bg-surface hover:border-ink'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  s.done ? 'border-transparent bg-brand text-brand-ink' : 'border-muted'
                }`}
                aria-hidden
              >
                {s.done && (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </span>
              <span className={`flex-1 text-sm ${s.done ? 'line-through' : 'font-medium'}`}>{s.label}</span>
              <span className="sr-only">{s.done ? t('gs.done') : t('gs.todo')}</span>
              {!s.done && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}
