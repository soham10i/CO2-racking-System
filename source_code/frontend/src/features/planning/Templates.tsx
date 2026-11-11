import type { Recurrence, Template, TemplateInput } from '../../api/types'
import { useDeleteTemplate, useLogTemplate, useSaveTemplate, useTemplates } from './hooks'
import { nextRunText, recurrenceOptions, recurrenceText } from './format'
import { CategoryTile } from '../activities/ActivityRow'
import { useActivityToasts } from '../activities/undo'
import { errorMessage } from '../../app/queryClient'
import { useToast } from '../../components/Toast'
import { ButtonLink, Card, EmptyState, ErrorBanner, Loading, SkeletonRows } from '../../components/ui'
import { formatKg, localToday, unitLabel } from '../../lib/format'

const iconButton = 'grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-fill focus-visible:bg-fill'

export default function Templates() {
  const templates = useTemplates()
  const log = useLogTemplate()
  const save = useSaveTemplate()
  const del = useDeleteTemplate()
  const toast = useToast()
  const activityToasts = useActivityToasts()

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    try {
      await action()
      toast({ message: ok })
    } catch (e) {
      activityToasts.failed(e, fail)
    }
  }

  async function logNow(t: Template) {
    try {
      activityToasts.created(await log.mutateAsync(t.id), `Logged “${t.name}” for today`)
    } catch (e) {
      activityToasts.failed(e, 'Could not log the template')
    }
  }

  /** Deletes at once; Undo recreates the template, resuming a series from its next run so nothing is booked twice. */
  async function remove(t: Template) {
    try {
      await del.mutateAsync(t.id)
    } catch (e) {
      activityToasts.failed(e, 'Could not delete the template')
      return
    }
    const input: TemplateInput = {
      name: t.name,
      category: t.category,
      subtype: t.subtype,
      quantity: t.quantity,
      passengers: t.passengers,
      recurrence: t.recurrence,
      ...(t.note ? { note: t.note } : {}),
      ...(t.recurrence !== 'NONE' ? { startsOn: t.nextRunOn ?? t.startsOn ?? tomorrow() } : {}),
    }
    toast({
      message: `Deleted “${t.name}”. Entries it logged stay.`,
      action: { label: 'Undo', run: () => run(() => save.mutateAsync({ input }), `Restored “${t.name}”`, 'Could not restore the template') },
    })
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Templates</h1>
          <p className="text-muted">One-tap entries for things you log often. Repeating ones log themselves.</p>
        </div>
        <ButtonLink to="/log/new" className="w-full sm:w-auto">+ New from an activity</ButtonLink>
      </header>

      <ErrorBanner message={templates.isError ? errorMessage(templates.error, 'Could not load templates') : null} />

      {templates.isPending ? (
        <Loading label="Loading templates">
          <Card className="py-1">
            <SkeletonRows rows={4} />
          </Card>
        </Loading>
      ) : templates.data && templates.data.length === 0 ? (
        <EmptyState art="template" title="No templates yet" action={<ButtonLink to="/log/new">Log an activity</ButtonLink>}>
          When you log an activity, tick “Save to quick add” or choose how often it repeats — a monthly electricity bill, a
          weekday commute. Templates log in one tap.
        </EmptyState>
      ) : (
        <Card className="px-3 py-1 md:px-4">
          <ul className="divide-y divide-line">
            {templates.data?.map((t) => (
              <li key={t.id} className="-mx-1 flex flex-wrap items-center gap-3.5 rounded-xl px-1 py-3.5 transition-colors hover:bg-fill sm:flex-nowrap">
                <CategoryTile category={t.category} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium leading-snug tracking-tight text-ink">
                    {t.name}
                    {t.recurrence !== 'NONE' && (
                      <span aria-hidden className="brand-chip inline-flex items-center gap-1 px-2 py-0.5 text-[11px]">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15m0 5v-5h5" />
                        </svg>
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {[t.label, `${t.quantity} ${unitLabel(t.unit)}`, t.passengers > 1 ? `${t.passengers} people` : null, nextRunText(t)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="shrink-0 pl-2 text-right tabular-nums">
                  <span className="font-display text-lg font-semibold tracking-tight text-ink">{formatKg(t.kgCo2e)}</span>
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">kg each</span>
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
                    className="min-h-[40px] flex-1 cursor-pointer rounded-full border border-field bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-ink focus:border-ink focus:outline-none focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-50 sm:flex-none"
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
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-ink transition hover:opacity-90 disabled:opacity-50"
                    title="Log for today"
                    disabled={log.isPending}
                    onClick={() => void logNow(t)}
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
                    onClick={() => void remove(t)}
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
