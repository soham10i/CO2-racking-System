import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Spinner } from '../../components/ui'

/** UX guard only: the API enforces authorization on every request. */
export function RequireAuth({ children, allowIncompleteOnboarding = false }: { children: ReactNode; allowIncompleteOnboarding?: boolean }) {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <Spinner />
  if (state.status === 'anon') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!allowIncompleteOnboarding && !state.user.profile.onboardingCompleted) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  if (state.status === 'loading') return <Spinner />
  if (state.status === 'authed') return <Navigate to="/" replace />
  return <>{children}</>
}
