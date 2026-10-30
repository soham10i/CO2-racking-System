import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLogTemplate, useTemplates } from './hooks'
import { recurrenceText } from './format'
import { CategoryTile } from '../activities/ActivityRow'
import { errorMessage } from '../../app/queryClient'
import { Card, ErrorBanner } from '../../components/ui'
import { formatKg } from '../../lib/format'

/** One tap logs a saved template for today. */
export function QuickAdd() {
  const templates = useTemplates()
  const log = useLogTemplate()
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function add(id: string, name: string) {
    setError(null)
    try {
      await log.mutateAsync(id)
      setDone(`Logged “${name}” for today`)
    } catch (e) {
      setError(errorMessage(e, 'Could not log the template'))
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Quick add</h2>
        <Link to="/templates" className="text-sm font-medium text-accent underline">
          Manage
        </Link>
      </div>
      <ErrorBanner message={error ?? (templates.isError ? errorMessage(templates.error, 'Could not load templates') : null)} />
      {templates.data && templates.data.length === 0 && (
        <p className="text-sm text-muted">
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
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-fill py-1.5 pl-1.5 pr-3 text-left text-sm transition hover:bg-fill-strong disabled:opacity-60"
              >
                <CategoryTile category={t.category} size={28} />
                <span>
                  <span className="block font-medium leading-tight">{t.name}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {formatKg(t.kgCo2e)} kg{recurrenceText(t) ? ` · ${recurrenceText(t)!.toLowerCase()}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="text-sm text-primary">
        {done}
      </p>
    </Card>
  )
}
