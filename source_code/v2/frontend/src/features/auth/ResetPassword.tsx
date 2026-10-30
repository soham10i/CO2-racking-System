import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { api, ApiError } from '../../api/client'
import { Button, ErrorBanner, TextField } from '../../components/ui'
import { newPassword } from '../../lib/validation'
import { AuthShell } from './AuthShell'

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
        <p role="status">Password updated. All other sessions were signed out.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <ErrorBanner message={error} />
          <TextField label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
          <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
            Update password
          </Button>
        </form>
      )}
      <Link className="text-sm text-accent underline" to="/login">
        Go to sign in
      </Link>
    </AuthShell>
  )
}
