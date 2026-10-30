import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ActivityRow } from '../activities/ActivityRow'
import { LogAgainButton } from '../activities/LogAgain'
import { useActivities } from '../activities/hooks'
import { useAuth } from '../auth/AuthContext'
import { useSummary, useTrend } from './hooks'
import { BudgetCard } from '../planning/BudgetCard'
import { QuickAdd } from '../planning/QuickAdd'
import { shareRows, toTrendRows, trendSentence } from './series'
import { errorMessage } from '../../app/queryClient'
import { BreakdownChart } from '../../components/charts/BarCharts'
import { ChartCard } from '../../components/charts/ChartCard'
import { TrendChart } from '../../components/charts/TrendChart'
import { ButtonLink, Card, ErrorBanner, Spinner } from '../../components/ui'
import { formatChange, formatKg, shortDate } from '../../lib/format'

export default function Dashboard() {
  const { state } = useAuth()
  const summary = useSummary()
  const trend = useTrend({ granularity: 'DAY' })
  const recent = useActivities({ size: 5 })
  const [actionError, setActionError] = useState<string | null>(null)
  if (state.status !== 'authed') return null
  const { profile } = state.user

  const s = summary.data
  const monthChange =
    s && s.previousMonthToDate > 0 ? ((s.month - s.previousMonthToDate) / s.previousMonthToDate) * 100 : undefined
  const kpis = s
    ? [
        { label: 'Today', kg: s.today },
        { label: 'This week', kg: s.week },
        {
          label: 'This month',
          kg: s.month,
          note: `${formatChange(monthChange)} vs the same days last month (${formatKg(s.previousMonthToDate)} kg)`,
        },
        { label: 'Year to date', kg: s.year },
      ]
    : []
  const trendRows = trend.data ? toTrendRows(trend.data) : []
  const shares = s ? shareRows(s.monthByCategory) : []
  const monthTotal = shares.reduce((a, r) => a + r.kg, 0)
  const error = summary.error ?? trend.error ?? recent.error

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hello, {profile.displayName}</h1>
          <p className="text-muted">Your footprint at a glance.</p>
        </div>
        <ButtonLink to="/log/new">+ Log activity</ButtonLink>
      </header>

      <ErrorBanner message={error ? errorMessage(error, 'Could not load your dashboard') : null} />
      {summary.isPending && <Spinner />}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="text-sm text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatKg(k.kg)} <span className="text-sm font-normal text-muted">kg CO2e</span>
            </p>
            {k.note && <p className="mt-1 text-xs text-muted">{k.note}</p>}
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <BudgetCard />
        <QuickAdd />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {trend.data && (
          <ChartCard
            title="Last 30 days"
            summary={trendSentence(trendRows)}
            actions={
              <Link to="/insights" className="text-sm font-medium text-accent underline">
                Explore
              </Link>
            }
            table={{
              columns: ['Day', 'kg CO2e'],
              rows: trendRows.map((r) => [r.label, formatKg(r.total)]),
            }}
          >
            <TrendChart rows={trendRows} mode="total" height={220} compact />
          </ChartCard>
        )}

        {s && (
          <ChartCard
            title="This month by category"
            summary={
              monthTotal === 0
                ? 'Nothing logged this month yet.'
                : `${shares[0]!.label} is the largest share at ${Math.round(shares[0]!.share)}%.`
            }
            table={{
              columns: ['Category', 'kg CO2e', 'Share'],
              rows: shares.map((r) => [r.label, formatKg(r.kg), `${Math.round(r.share)}%`]),
            }}
          >
            {monthTotal === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Log an activity to see the breakdown.</p>
            ) : (
              <BreakdownChart rows={shares} />
            )}
          </ChartCard>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <Link to="/log" className="text-sm font-medium text-accent underline">
            View all
          </Link>
        </div>
        <ErrorBanner message={actionError} />
        {recent.data && recent.data.content.length === 0 ? (
          <p className="mt-2 text-muted">No activities yet. Log a trip, a meal or a purchase to see your footprint.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {recent.data?.content.map((a) => (
              <li key={a.id}>
                <ActivityRow
                  activity={a}
                  meta={shortDate(a.occurredOn)}
                  actions={
                    <LogAgainButton
                      activity={a}
                      onError={setActionError}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-fill focus-visible:bg-fill"
                    />
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
