import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { api, ApiError } from '../../api/client'
import { Button, ErrorBanner, TextField } from '../../components/ui'
import { newPassword } from '../../lib/validation'
import { AuthShell } from './AuthShell'
import { currentLocale, translate, type MessageKey } from '../../lib/i18n'

const schema = z.object({ newPassword })
type Form = z.infer<typeof schema>

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: values.newPassword }, retryOn401: false })
      setDone(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    }
  })

  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <div className="flex items-start gap-4 rounded-2xl bg-fill p-4">
          <DoneBadge />
          <p role="status" className="text-sm leading-relaxed">Password updated. All other sessions were signed out.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <ErrorBanner message={error} />
          <TextField label="New password" type="password" autoComplete="new-password" error={errors.newPassword && translate(currentLocale(), errors.newPassword.message as MessageKey)} {...register('newPassword')} />
          <Button type="submit" className="w-full min-h-[48px] text-[15px]" disabled={isSubmitting || !token}>
            Update password
          </Button>
        </form>
      )}
      <Link className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline decoration-1 underline-offset-4 hover:decoration-2" to="/login">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
        Go to sign in
      </Link>
    </AuthShell>
  )
}

function DoneBadge() {
  return (
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12 5 5 9-10" />
      </svg>
    </span>
  )
}
