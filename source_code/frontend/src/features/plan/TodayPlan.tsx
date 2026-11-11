import { useGridSignal, useTodayPlan } from './hooks'
import { GridStrip } from './GridStrip'
import { PlanCardList } from './PlanCards'
import { errorMessage } from '../../app/queryClient'
import { Card, ErrorBanner, PageSkeleton } from '../../components/ui'
import { longDay } from '../../lib/format'
import { useT } from '../../lib/i18n'

export default function TodayPlan() {
  const plan = useTodayPlan()
  const signal = useGridSignal()
  const { t } = useT()

  if (plan.isPending) return <PageSkeleton />
  if (plan.isError) return <ErrorBanner message={errorMessage(plan.error, t('plan.loadError'))} />
  const p = plan.data

  return (
    <div className="space-y-6">
      <header className="max-w-2xl space-y-1.5">
        <span className="mb-3 block h-1.5 w-10 rounded-full bg-brand" aria-hidden />
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('plan.title')}</h1>
        <p className="text-muted">
          {longDay(p.date)} · {t('plan.subtitle')}
        </p>
      </header>
      <div className="grid gap-4 md:gap-5 lg:grid-cols-[3fr_2fr]">
        <Card className="space-y-4">
          {p.cards.length === 0 ? <p className="text-sm text-muted">{t('plan.empty')}</p> : <PlanCardList cards={p.cards.slice(0, 3)} />}
        </Card>
        <Card className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{t('plan.grid.title')}</h2>
            <p className="text-sm text-muted">{t('plan.grid.subtitle')}</p>
          </div>
          {/* The plan already carries today's signal; the dedicated endpoint keeps it fresh while the page is open. */}
          <GridStrip grid={signal.data ?? p.grid} />
        </Card>
      </div>
    </div>
  )
}
