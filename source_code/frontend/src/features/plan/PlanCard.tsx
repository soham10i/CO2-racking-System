import { Link } from 'react-router-dom'
import { useTodayPlan } from './hooks'
import { PlanCardList } from './PlanCards'
import { clock } from './GridStrip'
import { errorMessage } from '../../app/queryClient'
import { Card, ErrorBanner, Loading, SkeletonRows } from '../../components/ui'
import { useT } from '../../lib/i18n'

/** Dashboard summary of today's plan: the cards in compact form and the cleanest grid window, if any. */
export function PlanCard() {
  const plan = useTodayPlan()
  const { t } = useT()
  const p = plan.data
  const w = p?.grid.source === 'ENERGY_CHARTS' ? p.grid.bestWindow : null

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold tracking-tight">{t('plan.title')}</h2>
        <Link to="/plan" className="text-sm font-medium text-accent underline">
          {t('plan.openAll')}
        </Link>
      </div>
      {plan.isPending && <Loading label={t('plan.title')}><SkeletonRows rows={3} /></Loading>}
      <ErrorBanner message={plan.isError ? errorMessage(plan.error, t('plan.loadError')) : null} />
      {w && (
        <p className="text-sm">
          <span className="brand-chip text-sm">{t('plan.grid.window', { from: clock(w.from), to: clock(w.to) })}</span>
          <span className="ml-2 text-xs text-muted">{p?.grid.attribution}</span>
        </p>
      )}
      {p && p.cards.length === 0 && <p className="text-sm text-muted">{t('plan.empty')}</p>}
      {p && p.cards.length > 0 && <PlanCardList cards={p.cards.slice(0, 3)} compact />}
    </Card>
  )
}
