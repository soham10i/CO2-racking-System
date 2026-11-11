import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { Me } from '../../api/types'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, ErrorBanner } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { queryKeys } from '../../lib/queryKeys'
import { useT, type MessageKey } from '../../lib/i18n'
import { saveNotificationSettings, type NotificationSettings } from './api'
import { useNotificationSettings } from './hooks'
import { disablePush, enablePush, pushState, type PushState } from './push'

type Flag = 'budget' | 'templates' | 'digest'
const flags: { key: Flag; label: MessageKey; hint: MessageKey }[] = [
  { key: 'budget', label: 'notif.budget', hint: 'notif.budgetHint' },
  { key: 'templates', label: 'notif.templates', hint: 'notif.templatesHint' },
  { key: 'digest', label: 'notif.digest', hint: 'notif.digestHint' },
]

export function NotificationSettingsCard() {
  const { data } = useNotificationSettings()
  const client = useQueryClient()
  const { setUser } = useAuth()
  const toast = useToast()
  const { t } = useT()
  const [error, setError] = useState<string | null>(null)
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void pushState().then(setPush)
  }, [])

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : t('common.error'))

  async function toggle(key: Flag, value: boolean) {
    setError(null)
    try {
      const next = await saveNotificationSettings({ [key]: value })
      client.setQueryData<NotificationSettings>(queryKeys.notifications.settings(), next)
      // The digest flag is also part of the profile form; keep that copy current.
      if (key === 'digest') setUser(await api<Me>('/me'))
      toast({ message: t('notif.saved') })
    } catch (e) {
      fail(e)
    }
  }

  async function switchPush(on: boolean) {
    if (!data?.vapidPublicKey && on) return
    setBusy(true)
    setError(null)
    try {
      setPush(on ? await enablePush(data!.vapidPublicKey!) : await disablePush())
      await client.invalidateQueries({ queryKey: queryKeys.notifications.settings() })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const pushUsable = data?.pushAvailable && push !== null && push !== 'unsupported'

  return (
    <Card className="space-y-5 p-6 md:p-8">
      <div id="notifications" className="flex scroll-mt-20 items-start gap-4">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fill text-ink">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">{t('notif.channels')}</h2>
          <p className="text-sm text-muted">{t('notif.channelsHint')}</p>
        </div>
      </div>
      <div className="divide-y divide-line border-t border-line">
      <ErrorBanner message={error} />
      {flags.map((f) => (
        <label key={f.key} className="-mx-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-4 transition-colors hover:bg-fill">
          <span className="min-w-0">
            <span className="block font-medium">{t(f.label)}</span>
            <span className="block text-sm text-muted">{t(f.hint)}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            disabled={!data}
            checked={data?.[f.key] ?? false}
            onChange={(e) => void toggle(f.key, e.target.checked)}
          />
        </label>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{t('notif.push')}</span>
          <span className="block text-sm text-muted">
            {!pushUsable
              ? t('notif.pushUnavailable')
              : push === 'blocked'
                ? t('notif.pushBlocked')
                : push === 'on'
                  ? t('notif.pushOn')
                  : t('notif.pushHint')}
          </span>
        </span>
        {pushUsable && push !== 'blocked' && (
          <Button variant="secondary" disabled={busy} onClick={() => void switchPush(push !== 'on')}>
            {push === 'on' ? t('notif.pushDisable') : t('notif.pushEnable')}
          </Button>
        )}
      </div>
      </div>
    </Card>
  )
}
