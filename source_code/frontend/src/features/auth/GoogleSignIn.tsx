import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, loginWithGoogle } from '../../api/client'
import { ErrorBanner } from '../../components/ui'
import { useT } from '../../lib/i18n'
import { useTheme } from '../../lib/theme'

interface GoogleId {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode: 'popup'; use_fedcm_for_button?: boolean }): void
  renderButton(el: HTMLElement, options: Record<string, unknown>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Google sign-in could not load'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * "Sign in with Google" button. Shown only when the server has a Google client id configured; Google's own
 * script draws the button and hands back a signed ID token, which the API verifies before opening a session.
 */
export function GoogleSignIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { t, locale } = useT()
  const [theme] = useTheme()

  useEffect(() => {
    api<{ googleClientId?: string }>('/auth/providers', { retryOn401: false })
      .then((p) => setClientId(p.googleClientId ?? null))
      .catch(() => setClientId(null))
  }, [])

  useEffect(() => {
    if (!clientId || !ref.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        const id = window.google?.accounts.id
        if (cancelled || !id || !ref.current) return
        id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            setError(null)
            try {
              await loginWithGoogle(credential)
              navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('auth.googleFailed'))
            }
          },
        })
        const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        id.renderButton(ref.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: ref.current.clientWidth || 320,
          locale,
        })
      })
      .catch(() => !cancelled && setError(t('auth.googleFailed')))
    return () => {
      cancelled = true
    }
  }, [clientId, theme, locale, navigate, location.state, t])

  if (!clientId) return null
  return (
    <div className="space-y-5">
      <ErrorBanner message={error} />
      <div ref={ref} className="flex min-h-[44px] w-full justify-center overflow-hidden rounded-full" />
      <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  )
}
