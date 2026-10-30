import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { api, ApiError } from '../../api/client'
import { Button, ErrorBanner, TextField } from '../../components/ui'
import { email, newPassword } from '../../lib/validation'
import { AuthShell } from './AuthShell'

const schema = z.object({
  displayName: z.string().trim().min(1, 'Enter a name').max(80),
  email,
  password: newPassword,
})
type Form = z.infer<typeof schema>

export default function Register() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await api('/auth/register', { method: 'POST', body: values, retryOn401: false })
      setSentTo(values.email)
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldErrors[0]?.message ?? e.message) : 'Something went wrong. Please try again.')
    }
  })

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox">
        <p role="status" className="text-sm">
          If <strong>{sentTo}</strong> can be registered, we have sent a confirmation link. It expires in 24 hours.
        </p>
        <Link className="text-sm text-accent underline" to="/login">
          Back to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="Track, understand and reduce your CO2 footprint.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <TextField label="Name" autoComplete="name" error={errors.displayName?.message} {...register('displayName')} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters. A short passphrase works well."
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>
      <p className="text-sm">
        Already registered?{' '}
        <Link className="text-accent underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
