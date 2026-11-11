import { Link } from 'react-router-dom'
import { useLogTemplate, useTemplates } from './hooks'
import { recurrenceText } from './format'
import { CategoryTile } from '../activities/ActivityRow'
import { useActivityToasts } from '../activities/undo'
import { errorMessage } from '../../app/queryClient'
import { Card, ErrorBanner, Loading, Skeleton } from '../../components/ui'
import { formatKg } from '../../lib/format'

/** One tap logs a saved template for today. */
export function QuickAdd() {
  const templates = useTemplates()
  const log = useLogTemplate()
  const toasts = useActivityToasts()

  async function add(id: string, name: string) {
    try {
      toasts.created(await log.mutateAsync(id), `Logged “${name}” for today`)
    } catch (e) {
      toasts.failed(e, 'Could not log the template')
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">Quick add</h2>
        <Link to="/templates" className="liquid-capsule inline-flex min-h-[36px] items-center rounded-full px-4 text-sm font-medium text-ink">
          Manage
        </Link>
      </div>
      <ErrorBanner message={templates.isError ? errorMessage(templates.error, 'Could not load templates') : null} />
      {templates.isPending && (
        <Loading label="Loading templates" className="flex flex-wrap gap-2">
          {['w-28', 'w-36', 'w-24'].map((w) => (
            <Skeleton key={w} className={`h-[52px] rounded-full ${w}`} />
          ))}
        </Loading>
      )}
      {templates.data && templates.data.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          Tick “Save to quick add” when you log something you do often, and it appears here as a one-tap button. Bills and
          commutes can repeat on their own.
        </p>
      )}
      {templates.data && templates.data.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Templates">
          {templates.data.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={log.isPending}
                onClick={() => void add(t.id, t.name)}
                className="group flex min-h-[52px] items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3 text-left text-sm transition-all hover:border-ink active:scale-95 disabled:opacity-60"
              >
                <CategoryTile category={t.category} size={28} />
                <span>
                  <span className="block font-medium leading-tight">{t.name}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {formatKg(t.kgCo2e)} kg{recurrenceText(t) ? ` · ${recurrenceText(t)!.toLowerCase()}` : ''}
                  </span>
                </span>
                <span className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fill text-ink transition group-hover:bg-primary group-hover:text-primary-ink" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
