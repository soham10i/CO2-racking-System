import { useState } from 'react'
import type { Recurrence, Template } from '../../api/types'
import { useDeleteTemplate, useLogTemplate, useSaveTemplate, useTemplates } from './hooks'
import { nextRunText, recurrenceOptions, recurrenceText } from './format'
import { CategoryTile } from '../activities/ActivityRow'
import { errorMessage } from '../../app/queryClient'
import { ButtonLink, Card, ErrorBanner, Spinner } from '../../components/ui'
import { formatKg, localToday, unitLabel } from '../../lib/format'

const iconButton = 'grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-fill focus-visible:bg-fill'

export default function Templates() {
  const templates = useTemplates()
  const log = useLogTemplate()
  const save = useSaveTemplate()
  const del = useDeleteTemplate()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setError(null)
    setMessage(null)
    try {
      await action()
      setMessage(ok)
    } catch (e) {
      setError(errorMessage(e, fail))
    }
  }

  function changeRecurrence(t: Template, recurrence: Recurrence) {
    const input = {
      name: t.name,
      category: t.category,
      subtype: t.subtype,
      quantity: t.quantity,
      passengers: t.passengers,
      recurrence,
      version: t.version,
      ...(t.note ? { note: t.note } : {}),
      // Keep an existing series' anchor; a newly repeating template starts tomorrow (today is often logged already).
      ...(recurrence !== 'NONE' ? { startsOn: t.recurrence === recurrence && t.startsOn ? t.startsOn : tomorrow() } : {}),
    }
    void run(() => save.mutateAsync({ id: t.id, input }), recurrence === 'NONE' ? `“${t.name}” no longer repeats` : `“${t.name}” now repeats`, 'Could not update the template')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted">One-tap entries for things you log often. Repeating ones log themselves.</p>
        </div>
        <ButtonLink to="/log/new">+ New from an activity</ButtonLink>
      </header>

      <ErrorBanner message={error ?? (templates.isError ? errorMessage(templates.error, 'Could not load templates') : null)} />
      <p aria-live="polite" className="text-sm text-primary">
        {message}
      </p>

      {templates.isPending ? (
        <Spinner />
      ) : templates.data && templates.data.length === 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">No templates yet</h2>
          <p className="mt-1 text-muted">
            When you log an activity, tick “Save to quick add” or choose how often it repeats — a monthly electricity bill, a
            weekday commute.
          </p>
        </Card>
      ) : (
        <Card className="py-1">
          <ul className="divide-y divide-line">
            {templates.data?.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                <CategoryTile category={t.category} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{t.name}</p>
                  <p className="text-sm text-muted">
                    {[t.label, `${t.quantity} ${unitLabel(t.unit)}`, t.passengers > 1 ? `${t.passengers} people` : null, nextRunText(t)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="shrink-0 text-right tabular-nums">
                  <span className="font-semibold">{formatKg(t.kgCo2e)}</span>
                  <span className="block text-xs text-muted">kg each</span>
                </p>
                <div className="flex w-full shrink-0 items-center gap-1 sm:w-auto">
                  <label className="sr-only" htmlFor={`rec-${t.id}`}>
                    Repeat {t.name}
                  </label>
                  <select
                    id={`rec-${t.id}`}
                    value={t.recurrence}
                    disabled={save.isPending}
                    onChange={(e) => changeRecurrence(t, e.target.value as Recurrence)}
                    className="min-h-[36px] flex-1 rounded-lg border border-field bg-surface px-2 text-sm sm:flex-none"
                    title={recurrenceText(t) ?? 'Does not repeat'}
                  >
                    {recurrenceOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`${iconButton} hover:text-primary`}
                    title="Log for today"
                    disabled={log.isPending}
                    onClick={() => void run(() => log.mutateAsync(t.id), `Logged “${t.name}” for today`, 'Could not log the template')}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="sr-only">Log {t.name} for today</span>
                  </button>
                  <button
                    type="button"
                    className={`${iconButton} hover:text-danger`}
                    title="Delete"
                    onClick={() => {
                      if (window.confirm(`Delete the “${t.name}” template? Entries it already logged stay.`))
                        void run(() => del.mutateAsync(t.id), `Deleted “${t.name}”`, 'Could not delete the template')
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                    <span className="sr-only">Delete {t.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function tomorrow(): string {
  const d = new Date(`${localToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
