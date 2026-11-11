import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as client from '../../api/client'
import type { AuthResponse, Me } from '../../api/types'

type AuthState = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; user: Me }

interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<Me>
  logout: () => Promise<void>
  setUser: (user: Me) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    const apply = (s: AuthResponse | null) => setState(s ? { status: 'authed', user: s.user } : { status: 'anon' })
    client.onSessionChange(apply)
    // Silent sign-in from the httpOnly refresh cookie; there is no token in storage to read.
    void client.refreshSession()
    return () => client.onSessionChange(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => (await client.login(email, password)).user, [])
  const logout = useCallback(() => client.logout(), [])
  const setUser = useCallback((user: Me) => setState({ status: 'authed', user }), [])

  const value = useMemo(() => ({ state, login, logout, setUser }), [state, login, logout, setUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
