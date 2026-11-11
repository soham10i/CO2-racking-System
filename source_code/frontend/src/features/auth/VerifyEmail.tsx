import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { AuthShell } from './AuthShell'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [result, setResult] = useState<'pending' | 'ok' | 'error'>(token ? 'pending' : 'error')
  const [message, setMessage] = useState('This link is invalid or has expired.')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api('/auth/verify-email', { method: 'POST', body: { token }, retryOn401: false })
      .then(() => !cancelled && setResult('ok'))
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError) setMessage(e.message)
        setResult('error')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthShell title="Email confirmation">
      {result === 'pending' && (
        <div className="flex items-center gap-4 rounded-2xl bg-fill p-4">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink" />
          </span>
          <p role="status" className="text-sm">Confirming…</p>
        </div>
      )}
      {result === 'ok' && (
        <div className="flex items-start gap-4 rounded-2xl bg-fill p-4">
          <Badge d="m5 12 5 5 9-10" tone="bg-brand text-brand-ink" />
          <p role="status" className="text-sm leading-relaxed">Your email is confirmed. You can now sign in.</p>
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-start gap-4 rounded-2xl border border-danger/30 bg-danger/10 p-4">
          <Badge d="M12 8v5m0 3h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" tone="bg-danger text-danger-ink" />
          <p role="alert" className="text-sm font-medium leading-relaxed text-danger">{message}</p>
        </div>
      )}
      <Link className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink transition-opacity hover:opacity-90" to="/login">
        Go to sign in
      </Link>
    </AuthShell>
  )
}

function Badge({ d, tone }: { d: string; tone: string }) {
  return (
    <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  )
}
