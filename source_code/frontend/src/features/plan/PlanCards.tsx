import { useState } from 'react'
import { usePlanFeedback } from './hooks'
import type { PlanCard as PlanCardData, PlanEvent } from '../../api/types'
import { CategoryTile } from '../activities/ActivityRow'
import { errorMessage } from '../../app/queryClient'
import { Button } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { formatKg } from '../../lib/format'
import { useT } from '../../lib/i18n'

/** Today's cards with their feedback buttons; shared by the plan page and the dashboard card. */
export function PlanCardList({ cards, compact = false }: { cards: PlanCardData[]; compact?: boolean }) {
  const feedback = usePlanFeedback()
  const toast = useToast()
  const { t } = useT()

  async function send(card: PlanCardData, event: PlanEvent, ifThen: string) {
    const edited = ifThen.trim() && ifThen.trim() !== card.ifThen ? ifThen.trim() : undefined
    try {
      await feedback.mutateAsync({ key: card.key, event, ...(edited ? { ifThen: edited } : {}) })
      if (event === 'DONE') {
        // Point at the next step rather than closing the topic (no moral licensing).
        const next = cards.find((c) => c.key !== card.key && c.status !== 'DONE')
        toast({ message: next ? t('plan.toast.doneNext', { title: next.title }) : t('plan.toast.doneGap') })
      } else {
        toast({ message: t(`plan.toast.${event}`, { title: card.title }) })
      }
    } catch (e) {
      toast({ message: errorMessage(e, t('plan.feedbackError')) ?? t('plan.feedbackError'), tone: 'error' })
    }
  }

  return (
    <ol className="space-y-3">
      {cards.map((c) => (
        <PlanItem key={c.key} card={c} compact={compact} busy={feedback.isPending} onSend={(event, ifThen) => void send(c, event, ifThen)} />
      ))}
    </ol>
  )
}

function PlanItem({
  card,
  compact,
  busy,
  onSend,
}: {
  card: PlanCardData
  compact: boolean
  busy: boolean
  onSend: (event: PlanEvent, ifThen: string) => void
}) {
  const { t } = useT()
  const [ifThen, setIfThen] = useState(card.ifThen)
  const s = card.saving
  const fieldId = `ifthen-${card.key}`

  return (
    <li className="rounded-2xl border border-line bg-raised p-4" aria-labelledby={`${fieldId}-title`}>
      <div className="flex items-start gap-3">
        <CategoryTile category={card.category} size={compact ? 32 : 36} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-fill px-2.5 py-0.5 text-ink">{t(`plan.slot.${card.slot}`)}</span>
            <span className="text-muted">{t(`plan.effort.${card.effort}`)}</span>
            {card.status === 'ADOPTED' && <span className="brand-chip">{t('plan.accepted')}</span>}
          </div>
          <h3 id={`${fieldId}-title`} className="font-medium leading-snug">{card.title}</h3>
        </div>
        <p className="shrink-0 text-right tabular-nums">
          <span className="sr-only">{t('plan.savingLabel')}: </span>
          <span className="inline-block rounded-full bg-brand px-2.5 py-0.5 font-display text-sm font-semibold tracking-tight text-brand-ink">
            {t('plan.saving', { low: formatKg(s.lowKg), high: formatKg(s.highKg) })}
          </span>
          <span className="mt-0.5 block text-xs text-muted">{t(`plan.per.${s.per}`)}</span>
        </p>
      </div>
      {!compact && <p className="mt-2 text-sm text-muted">{card.detail}</p>}
      <p className="mt-2 text-sm">
        <span className="font-medium">{t('plan.whyNow')}: </span>
        <span className="text-muted">{card.whyNow}</span>
      </p>
      {card.sources.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          {t('plan.sources')}: {[...new Set(card.sources.map((src) => `${src.label} (${src.year})`))].join("; ")}
        </p>
      )}
      {!compact && (
        <div className="mt-3 space-y-1.5">
          <label htmlFor={fieldId} className="block text-[13px] font-medium text-ink">
            {t('plan.ifThen')}
          </label>
          <input
            id={fieldId}
            value={ifThen}
            maxLength={200}
            onChange={(e) => setIfThen(e.target.value)}
            aria-describedby={`${fieldId}-hint`}
            className="block min-h-[44px] w-full rounded-xl border border-field/60 bg-surface px-4 py-2.5 text-sm text-ink focus:border-ink focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
          />
          <p id={`${fieldId}-hint`} className="text-xs text-muted">
            {t('plan.ifThenHint')} ({ifThen.length}/200)
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {card.status !== 'ADOPTED' && (
          <Button className="min-h-[40px] px-3" disabled={busy} onClick={() => onSend('ADOPTED', ifThen)}>
            {t('plan.accept')}
          </Button>
        )}
        <Button variant={card.status === 'ADOPTED' ? 'primary' : 'secondary'} className="min-h-[40px] px-3" disabled={busy} onClick={() => onSend('DONE', ifThen)}>
          {t('plan.done')}
        </Button>
        <Button variant="secondary" className="min-h-[40px] px-3" disabled={busy} onClick={() => onSend('SNOOZED', ifThen)}>
          {t('plan.snooze')}
        </Button>
        <Button variant="ghost" className="min-h-[40px] px-3" disabled={busy} onClick={() => onSend('DISMISSED', ifThen)}>
          {t('plan.dismiss')}
        </Button>
      </div>
    </li>
  )
}
