import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '../components/Toast'
import { AuthProvider, useAuth } from '../features/auth/AuthContext'
import { createQueryClient } from './queryClient'
import { I18nProvider, useT } from '../lib/i18n'

/** Drops every cached response when the session ends, so the next user never sees the previous one's data. */
function ClearCacheOnSignOut() {
  const { state } = useAuth()
  const client = useQueryClient()
  useEffect(() => {
    if (state.status === 'anon') client.clear()
  }, [state.status, client])
  return null
}

/** The account's saved language wins once signed in, so every device shows the same one. */
function SyncLocale() {
  const { state } = useAuth()
  const { locale, setLocale } = useT()
  const saved = state.status === 'authed' ? state.user.profile.locale : undefined
  useEffect(() => {
    if (saved && saved !== locale) setLocale(saved)
  }, [saved, locale, setLocale])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  return (
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <I18nProvider>
            <ClearCacheOnSignOut />
            <SyncLocale />
            <ToastProvider>{children}</ToastProvider>
          </I18nProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
