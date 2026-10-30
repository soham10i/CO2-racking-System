import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityRow } from './ActivityRow'
import { LogAgainButton } from './LogAgain'
import { useActivities, useDeleteActivity } from './hooks'
import { errorMessage } from '../../app/queryClient'
import type { Activity, Category } from '../../api/types'
import { Button, ButtonLink, Card, ErrorBanner, Spinner, TextField } from '../../components/ui'
import { categories, categoryLabel, formatKg, localToday } from '../../lib/format'

const PAGE_SIZE = 50

const dayFormat = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** "Today", "Yesterday" or "Thursday, 29 October" for an ISO date. */
function dayHeading(iso: string, today: string): string {
  if (iso === today) return 'Today'
  const y = new Date(`${today}T00:00:00Z`)
  y.setUTCDate(y.getUTCDate() - 1)
  if (iso === y.toISOString().slice(0, 10)) return 'Yesterday'
  return dayFormat.format(new Date(`${iso}T00:00:00Z`))
}

/** The API returns newest first, so consecutive rows with the same date form one day. */
function groupByDay(items: Activity[]) {
  const days: { date: string; items: Activity[]; total: number }[] = []
  for (const a of items) {
    const last = days[days.length - 1]
    if (last && last.date === a.occurredOn) {
      last.items.push(a)
      last.total += a.kgCo2e
    } else days.push({ date: a.occurredOn, items: [a], total: a.kgCo2e })
  }
  return days
}

const iconButton = 'grid h-9 w-8 sm:w-9 place-items-center rounded-full text-muted transition hover:bg-fill focus-visible:bg-fill'

export default function ActivityLog() {
  const [category, setCategory] = useState<Category | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, error, isPending } = useActivities({ category, from, to, page, size: PAGE_SIZE })
  const del = useDeleteActivity()
  const days = useMemo(() => groupByDay(data?.content ?? []), [data])
  const today = localToday()

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete this ${label} entry?`)) return
    setActionError(null)
    try {
      await del.mutateAsync(id)
      // Deleting the last row of a later page would leave an empty page behind.
      if (data && data.content.length === 1 && page > 0) setPage(page - 1)
    } catch (e) {
      setActionError(errorMessage(e, 'Could not delete the entry'))
    }
  }

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity log</h1>
          {data && data.totalElements > 0 && (
            <p className="text-muted">
              {data.totalElements} {data.totalElements === 1 ? 'entry' : 'entries'}
            </p>
          )}
        </div>
        <ButtonLink to="/log/new">+ Log activity</ButtonLink>
      </header>

      <Card className="space-y-3">
        <div className="overflow-x-auto">
          <div className="segmented" role="group" aria-label="Category">
            {[{ value: '' as const, label: 'All' }, ...categories.map((c) => ({ value: c, label: categoryLabel[c] }))].map((o) => (
              <button
                key={o.value || 'all'}
                type="button"
                className="segment whitespace-nowrap"
                aria-pressed={category === o.value}
                onClick={() => resetPage(setCategory)(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Date range">
          <TextField label="From" type="date" value={from} max={to || today} onChange={(e) => resetPage(setFrom)(e.target.value)} />
          <TextField label="To" type="date" value={to} min={from || undefined} max={today} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </form>
      </Card>

      <ErrorBanner message={actionError ?? (error ? errorMessage(error, 'Could not load activities') : null)} />
      {isPending ? (
        <Spinner />
      ) : data && data.content.length === 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">Nothing here yet</h2>
          <p className="mt-1 text-muted">
            {category || from || to ? 'No entries match these filters.' : 'Log your first trip, meal, purchase or bin bag to get started.'}
          </p>
        </Card>
      ) : (
        days.map((d) => (
          <section key={d.date} aria-labelledby={`day-${d.date}`} className="space-y-2">
            <div className="flex items-baseline justify-between px-2">
              <h2 id={`day-${d.date}`} className="text-sm font-semibold uppercase tracking-wide text-muted">
                {dayHeading(d.date, today)}
              </h2>
              <p className="text-sm text-muted tabular-nums">
                <span className="font-semibold text-ink">{formatKg(d.total)}</span> kg CO2e
              </p>
            </div>
            <Card className="py-1">
              <ul className="divide-y divide-line">
                {d.items.map((a) => (
                  <li key={a.id}>
                    <ActivityRow
                      activity={a}
                      actions={
                        <div className="flex shrink-0 gap-0.5">
                          <LogAgainButton activity={a} className={iconButton} onError={setActionError} />
                          <Link to={`/log/${a.id}/edit`} className={`${iconButton} hover:text-accent`} title="Edit">
                            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4" />
                            </svg>
                            <span className="sr-only">Edit {a.label} on {a.occurredOn}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void remove(a.id, a.label)}
                            className={`${iconButton} hover:text-danger`}
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                            </svg>
                            <span className="sr-only">Delete {a.label} on {a.occurredOn}</span>
                          </button>
                        </div>
                      }
                    />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Newer
          </Button>
          <span className="text-sm text-muted">
            Page {data.page + 1} of {data.totalPages}
          </span>
          <Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>
            Older
          </Button>
        </nav>
      )}
    </div>
  )
}
