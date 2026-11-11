import { Link } from 'react-router-dom'
import { CountUp } from '../../components/CountUp'
import { ActivityRow } from '../activities/ActivityRow'
import { LogAgainButton } from '../activities/LogAgain'
import { useActivities } from '../activities/hooks'
import { useAuth } from '../auth/AuthContext'
import { useSummary, useTrend } from './hooks'
import { GettingStarted } from './GettingStarted'
import { BudgetCard } from '../planning/BudgetCard'
import { QuickAdd } from '../planning/QuickAdd'
import { PlanCard } from '../plan/PlanCard'
import { NexusCard } from '../nexus/NexusCard'
import { shareRows, toTrendRows, trendSentence } from './series'
import { errorMessage } from '../../app/queryClient'
import { BreakdownChart } from '../../components/charts/BarCharts'
import { ChartCard } from '../../components/charts/ChartCard'
import { TrendChart } from '../../components/charts/TrendChart'
import { ButtonLink, Card, EmptyState, ErrorBanner, Loading, Skeleton, SkeletonCard, SkeletonRows } from '../../components/ui'
import { formatChange, formatKg, shortDate } from '../../lib/format'
import { useT } from '../../lib/i18n'

export default function Dashboard() {
  const { state } = useAuth()
  const summary = useSummary()
  const trend = useTrend({ granularity: 'DAY' })
  const recent = useActivities({ size: 5 })
  const { t } = useT()
  if (state.status !== 'authed') return null
  const { profile } = state.user

  const s = summary.data
  const monthChange =
    s && s.previousMonthToDate > 0 ? ((s.month - s.previousMonthToDate) / s.previousMonthToDate) * 100 : undefined
  const kpis = s
    ? [
        { label: t('dash.today'), kg: s.today },
        { label: t('dash.week'), kg: s.week },
        {
          label: t('dash.month'),
          kg: s.month,
          note: t('dash.monthNote', { change: formatChange(monthChange), kg: formatKg(s.previousMonthToDate) }),
        },
        { label: t('dash.year'), kg: s.year },
      ]
    : []
  const trendRows = trend.data ? toTrendRows(trend.data) : []
  const shares = s ? shareRows(s.monthByCategory) : []
  const monthTotal = shares.reduce((a, r) => a + r.kg, 0)
  const error = summary.error ?? trend.error ?? recent.error

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="mb-3 block h-1.5 w-10 rounded-full bg-brand" aria-hidden />
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            {t('dash.hello', { name: profile.displayName })}
          </h1>
          <p className="mt-1 text-muted">{t('dash.subtitle')}</p>
        </div>
        <ButtonLink to="/log/new" className="w-full sm:w-auto">
          {t('dash.logActivity')}
        </ButtonLink>
      </header>

      <ErrorBanner message={error ? errorMessage(error, t('dash.loadError')) : null} />
      <GettingStarted userId={state.user.id} />
      <PlanCard />
      <NexusCard />
      <section aria-label={t('dash.totals')} className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        {summary.isPending &&
          [t('dash.today'), t('dash.week'), t('dash.month'), t('dash.year')].map((label) => (
            <div key={label} className="glass-liquid rounded-card p-5 md:p-6">
              <p className="text-sm font-medium text-muted">{label}</p>
              <Loading label={t('dash.loading', { label })}>
                <Skeleton className="mt-4 h-10 w-28" />
              </Loading>
            </div>
          ))}
        {kpis.map((k, i) => {
          const hero = i === 2
          return (
            <div
              key={k.label}
              className={`flex min-h-[148px] flex-col justify-between rounded-card p-5 md:p-6 ${
                hero ? 'bg-brand text-brand-ink' : 'glass-liquid'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-medium ${hero ? 'text-brand-ink' : 'text-muted'}`}>{k.label}</p>
                {hero && monthChange !== undefined && (
                  <span className="rounded-full border border-brand-ink px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-ink" aria-hidden>
                    {formatChange(monthChange)}
                  </span>
                )}
              </div>
              <div>
                <p className="mt-4 font-display text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">
                  <CountUp value={k.kg} format={formatKg} />{' '}
                  <span className={`font-sans text-sm font-medium tracking-normal ${hero ? 'text-brand-ink' : 'text-muted'}`}>
                    {t('common.kg')}
                  </span>
                </p>
                {k.note && <p className={`mt-2 text-xs ${hero ? 'text-brand-ink' : 'text-muted'}`}>{k.note}</p>}
              </div>
            </div>
          )
        })}
      </section>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
        <BudgetCard />
        <QuickAdd />
      </div>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[3fr_2fr]">
        {trend.isPending && <SkeletonCard height="h-[220px]" />}
        {summary.isPending && <SkeletonCard height="h-[220px]" />}
        {trend.data && (
          <ChartCard
            title={t('dash.last30')}
            summary={trendSentence(trendRows)}
            actions={
              <Link to="/insights" className="text-sm font-medium text-accent underline">
                {t('dash.explore')}
              </Link>
            }
            table={{
              columns: [t('dash.day'), t('common.kg')],
              rows: trendRows.map((r) => [r.label, formatKg(r.total)]),
            }}
          >
            <TrendChart rows={trendRows} mode="total" height={220} compact />
          </ChartCard>
        )}

        {s && (
          <ChartCard
            title={t('dash.byCategory')}
            summary={
              monthTotal === 0
                ? t('dash.nothingThisMonth')
                : t('dash.largestShare', { label: shares[0]!.label, pct: Math.round(shares[0]!.share) })
            }
            table={{
              columns: [t('dash.category'), t('common.kg'), t('dash.share')],
              rows: shares.map((r) => [r.label, formatKg(r.kg), `${Math.round(r.share)}%`]),
            }}
          >
            {monthTotal === 0 ? (
              <p className="py-8 text-center text-sm text-muted">{t('dash.breakdownEmpty')}</p>
            ) : (
              <BreakdownChart rows={shares} />
            )}
          </ChartCard>
        )}
      </div>

      {recent.data && recent.data.content.length === 0 ? (
        <EmptyState
          art="log"
          title={t('dash.emptyTitle')}
          action={
            <>
              <ButtonLink to="/log/new">{t('dash.logFirst')}</ButtonLink>
              <ButtonLink to="/settings" variant="secondary">{t('dash.importCsv')}</ButtonLink>
            </>
          }
        >
          {t('dash.emptyBody')}
        </EmptyState>
      ) : (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">{t('dash.recent')}</h2>
            <Link to="/log" className="text-sm font-medium text-accent underline">
              {t('dash.viewAll')}
            </Link>
          </div>
          {recent.isPending ? (
            <Loading label={t('dash.loadingRecent')}>
              <SkeletonRows />
            </Loading>
          ) : (
            <ul className="-mx-2 mt-2 divide-y divide-line">
              {recent.data?.content.map((a) => (
                <li key={a.id} className="rounded-2xl px-2 transition hover:bg-fill">
                  <ActivityRow
                    activity={a}
                    meta={shortDate(a.occurredOn)}
                    actions={
                      <LogAgainButton
                        activity={a}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-fill focus-visible:bg-fill"
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
