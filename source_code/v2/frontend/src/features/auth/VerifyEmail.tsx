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
      {result === 'pending' && <p role="status">Confirming…</p>}
      {result === 'ok' && <p role="status">Your email is confirmed. You can now sign in.</p>}
      {result === 'error' && <p role="alert" className="text-danger">{message}</p>}
      <Link className="text-sm text-accent underline" to="/login">
        Go to sign in
      </Link>
    </AuthShell>
  )
}
