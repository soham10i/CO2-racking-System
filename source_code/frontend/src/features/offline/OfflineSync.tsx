import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { flush, pendingFor } from './queue'
import { createActivity } from '../activities/api'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../../components/Toast'
import { queryKeys } from '../../lib/queryKeys'

/** Sends queued entries when the app starts or the connection returns, and says when the app is offline. */
export function OfflineSync() {
  const { state } = useAuth()
  const userId = state.status === 'authed' ? state.user.id : null
  const toast = useToast()
  const client = useQueryClient()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pending, setPending] = useState(() => (userId ? pendingFor(userId) : 0))

  const sync = useCallback(async () => {
    if (!userId || !navigator.onLine || pendingFor(userId) === 0) return
    const r = await flush(userId, createActivity)
    if (r.sent || r.rejected) {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.activities.all }),
        client.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      ])
      const parts = [r.sent && `Synced ${r.sent} ${r.sent === 1 ? 'entry' : 'entries'} saved offline`, r.rejected && `${r.rejected} could not be saved`]
      toast({ message: parts.filter(Boolean).join(' · '), tone: r.rejected ? 'error' : 'success' })
    }
  }, [userId, client, toast])

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine)
      setPending(userId ? pendingFor(userId) : 0)
    }
    const back = () => {
      update()
      void sync()
    }
    window.addEventListener('online', back)
    window.addEventListener('offline', update)
    window.addEventListener('co2-offline-queue', update)
    void sync()
    return () => {
      window.removeEventListener('online', back)
      window.removeEventListener('offline', update)
      window.removeEventListener('co2-offline-queue', update)
    }
  }, [userId, sync])

  if (online && pending === 0) return null
  return (
    <p role="status" className="mb-6 flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 text-sm font-medium">
      <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${online ? 'bg-brand text-brand-ink' : 'bg-primary text-primary-ink'}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01" />
          {!online && <path d="M3 3l18 18" />}
        </svg>
      </span>
      {!online ? 'You are offline. New entries are kept on this device' : 'Back online, sending saved entries'}
      {pending > 0 && ` · ${pending} waiting`}
    </p>
  )
}
