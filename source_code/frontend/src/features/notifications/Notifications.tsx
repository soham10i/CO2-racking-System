import { Link } from 'react-router-dom'
import { errorMessage } from '../../app/queryClient'
import { Button, Card, EmptyState, ErrorBanner, Loading, SkeletonRows } from '../../components/ui'
import { currentLocale, useT } from '../../lib/i18n'
import type { AppNotification } from './api'
import { useMarkRead, useNotifications } from './hooks'

const when = (iso: string) =>
  new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

/** Each kind gets its own glyph, so the list never relies on colour alone. */
const glyph: Record<AppNotification['kind'], string> = {
  BUDGET_AT_RISK: 'M12 4 3 20h18L12 4Zm0 6v4m0 3h.01',
  BUDGET_OVER: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5m0 3h.01',
  WEEKLY_DIGEST: 'M4 6h16v12H4V6Zm0 0 8 6 8-6',
  TEMPLATE_BOOKED: 'M6 4h12v16l-6-4-6 4V4Zm3 6 2 2 4-4',
  HOUSEHOLD: 'M4 11 12 4l8 7v9H4v-9Zm6 9v-5h4v5',
}

export default function Notifications() {
  const { data, error, isPending } = useNotifications()
  const mark = useMarkRead()
  const { t } = useT()

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('notif.title')}</h1>
          {data && data.unread > 0 && (
            <span aria-hidden className="brand-chip tabular-nums">
              {data.unread}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && data.unread > 0 && (
            <Button variant="secondary" onClick={() => mark.mutate(undefined)} disabled={mark.isPending}>
              {t('notif.markAll')}
            </Button>
          )}
          <Link to="/settings#notifications" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent underline decoration-1 underline-offset-4 hover:decoration-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 7h10m4 0h2M4 17h4m4 0h8M14 5v4m-4 6v4" />
            </svg>
            {t('notif.settings')}
          </Link>
        </div>
      </header>
      <ErrorBanner message={error ? errorMessage(error, t('notif.loadError')) : null} />
      {isPending ? (
        <Loading label={t('notif.title')}>
          <Card className="px-5 py-1 md:px-6">
            <SkeletonRows rows={4} />
          </Card>
        </Loading>
      ) : data && data.items.length === 0 ? (
        <EmptyState art="bell" title={t('notif.title')}>
          {t('notif.empty')}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-line">
            {data?.items.map((n) => (
              <li key={n.id} className={`relative flex items-start gap-4 px-5 py-4 transition-colors hover:bg-fill md:px-6 ${n.read ? '' : 'bg-raised'}`}>
                {!n.read && <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand" />}
                <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${n.read ? 'bg-fill text-muted' : 'bg-brand text-brand-ink'}`} aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={glyph[n.kind]} />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[15px] ${n.read ? 'font-medium text-ink' : 'font-semibold text-ink'}`}>
                    {!n.read && <span className="sr-only">{t('notif.unread')}: </span>}
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <p className="mt-2 text-xs text-muted tabular-nums">
                    <time dateTime={n.createdAt}>{when(n.createdAt)}</time>
                    {n.link && (
                      <>
                        {' · '}
                        <Link to={n.link} className="font-medium text-accent underline" onClick={() => !n.read && mark.mutate(n.id)}>
                          {t('notif.open')}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => mark.mutate(n.id)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-field hover:bg-surface hover:text-ink"
                    title={t('notif.markRead')}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                    <span className="sr-only">{t('notif.markRead')}: {n.title}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
