import { ButtonLink, Card } from '../../components/ui'
import { useT } from '../../lib/i18n'

/** Dashboard entry point to the assistant. */
export function NexusCard() {
  const { t } = useT()
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{t('nexus.card.title')}</h2>
      <p className="text-sm text-muted">{t('nexus.card.body')}</p>
      <ButtonLink to="/nexus" variant="secondary" className="self-start">{t('nexus.card.open')}</ButtonLink>
    </Card>
  )
}
