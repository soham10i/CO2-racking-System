import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ActivityRow } from './ActivityRow'
import { LogAgainButton } from './LogAgain'
import { SwipeRow } from '../../components/SwipeRow'
import { useActivities } from './hooks'
import { useActivityToasts } from './undo'
import { errorMessage } from '../../app/queryClient'
import type { Activity, Category } from '../../api/types'
import { Button, ButtonLink, Card, EmptyState, ErrorBanner, Loading, Skeleton, SkeletonRows, TextField } from '../../components/ui'
import { categories, categoryLabel, formatKg, localToday, longDay } from '../../lib/format'
import { translate, currentLocale, useT } from '../../lib/i18n'

const PAGE_SIZE = 50

/** "Today", "Yesterday" or "Thursday, 29 October" for an ISO date. */
function dayHeading(iso: string, today: string): string {
  if (iso === today) return translate(currentLocale(), 'log.today')
  const y = new Date(`${today}T00:00:00Z`)
  y.setUTCDate(y.getUTCDate() - 1)
  if (iso === y.toISOString().slice(0, 10)) return translate(currentLocale(), 'log.yesterday')
  return longDay(iso)
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

const iconButton = 'grid h-9 w-8 sm:w-9 place-items-center rounded-full text-muted transition-colors hover:bg-fill hover:text-ink focus-visible:bg-fill'

export default function ActivityLog() {
  const [category, setCategory] = useState<Category | ''>('')
  // The calendar heatmap opens a single day here (router state, so the date never lands in the URL).
  const initialDate = (useLocation().state as { date?: string } | null)?.date ?? ''
  const [from, setFrom] = useState(initialDate)
  const [to, setTo] = useState(initialDate)
  const [page, setPage] = useState(0)
  const { data, error, isPending } = useActivities({ category, from, to, page, size: PAGE_SIZE })
  const toasts = useActivityToasts()
  const days = useMemo(() => groupByDay(data?.content ?? []), [data])
  const today = localToday()
  const { t } = useT()

  /** Deletes at once; the toast's Undo recreates the entry, so there is no confirm dialog. */
  async function remove(a: Activity) {
    const lastOnPage = data && data.content.length === 1 && page > 0
    // Deleting the last row of a later page would leave an empty page behind.
    if ((await toasts.remove(a)) && lastOnPage) setPage(page - 1)
  }

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('log.title')}</h1>
          {data && data.totalElements > 0 && (
            <p className="text-muted tabular-nums">
              {data.totalElements === 1 ? t('log.entry') : t('log.entries', { count: data.totalElements })}
            </p>
          )}
        </div>
        <ButtonLink to="/log/new" className="w-full sm:w-auto">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('dash.logActivity')}
        </ButtonLink>
      </header>

      <Card className="space-y-4 p-4 md:p-5">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="segmented" role="group" aria-label={t('log.category')}>
            {[{ value: '' as const, label: t('log.all') }, ...categories.map((c) => ({ value: c, label: categoryLabel[c] }))].map((o) => (
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
        <form className="grid grid-cols-2 gap-3 md:max-w-lg" onSubmit={(e) => e.preventDefault()} aria-label={t('log.dateRange')}>
          <TextField label={t('log.from')} type="date" value={from} max={to || today} onChange={(e) => resetPage(setFrom)(e.target.value)} />
          <TextField label={t('log.to')} type="date" value={to} min={from || undefined} max={today} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </form>
      </Card>

      <ErrorBanner message={error ? errorMessage(error, t('log.loadError')) : null} />
      {isPending ? (
        <Loading label={t('log.loading')} className="space-y-2">
          <Skeleton className="mx-2 h-3.5 w-24" />
          <Card className="py-1">
            <SkeletonRows rows={5} />
          </Card>
        </Loading>
      ) : data && data.content.length === 0 ? (
        category || from || to ? (
          <EmptyState
            art="filter"
            title={t('log.noMatchTitle')}
            action={
              <Button variant="secondary" onClick={() => { setCategory(''); setFrom(''); setTo(''); setPage(0) }}>
                {t('log.clearFilters')}
              </Button>
            }
          >
            {t('log.noMatchBody')}
          </EmptyState>
        ) : (
          <EmptyState art="log" title={t('log.emptyTitle')} action={<ButtonLink to="/log/new">{t('dash.logFirst')}</ButtonLink>}>
            {t('log.emptyBody')}
          </EmptyState>
        )
      ) : (
        days.map((d) => (
          <section key={d.date} aria-labelledby={`day-${d.date}`} className="space-y-2">
            <div className="flex items-end justify-between gap-3 px-1 pt-2">
              <h2 id={`day-${d.date}`} className="font-display text-lg font-semibold tracking-tight text-ink">
                {dayHeading(d.date, today)}
              </h2>
              <p className="rounded-full bg-fill px-3 py-1 text-sm text-muted tabular-nums">
                <span className="font-semibold text-ink">{formatKg(d.total)}</span> {t('common.kg')}
              </p>
            </div>
            <Card className="px-3 py-1 md:px-4">
              <ul className="divide-y divide-line">
                {d.items.map((a) => (
                  <li key={a.id}>
                    <SwipeRow
                      right={{ label: t('log.again'), tone: 'primary', run: () => void toasts.logAgain(a) }}
                      left={a.share && !a.share.editable ? undefined : { label: t('log.delete'), tone: 'danger', run: () => void remove(a) }}
                    >
                    <ActivityRow
                      activity={a}
                      actions={
                        <div className="flex shrink-0 gap-0.5">
                          <LogAgainButton activity={a} className={iconButton} />
                          {(!a.share || a.share.editable) && (<>
                          <Link to={`/log/${a.id}/edit`} className={iconButton} title={t('log.edit')}>
                            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4" />
                            </svg>
                            <span className="sr-only">{t('log.editLabel', { label: a.label, date: a.occurredOn })}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void remove(a)}
                            className={`${iconButton} hover:text-danger`}
                            title={t('log.delete')}
                          >
                            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                            </svg>
                            <span className="sr-only">{t('log.deleteLabel', { label: a.label, date: a.occurredOn })}</span>
                          </button>
                          </>)}
                        </div>
                      }
                    />
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label={t('log.pagination')} className="flex items-center justify-between gap-3 pt-2">
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            {t('log.newer')}
          </Button>
          <span className="text-sm font-medium tabular-nums text-muted">
            {t('log.page', { page: data.page + 1, total: data.totalPages })}
          </span>
          <Button variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>
            {t('log.older')}
          </Button>
        </nav>
      )}
    </div>
  )
}
