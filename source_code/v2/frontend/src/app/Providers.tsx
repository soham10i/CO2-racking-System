import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../features/auth/AuthContext'
import { createQueryClient } from './queryClient'

/** Drops every cached response when the session ends, so the next user never sees the previous one's data. */
function ClearCacheOnSignOut() {
  const { state } = useAuth()
  const client = useQueryClient()
  useEffect(() => {
    if (state.status === 'anon') client.clear()
  }, [state.status, client])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  return (
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ClearCacheOnSignOut />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
