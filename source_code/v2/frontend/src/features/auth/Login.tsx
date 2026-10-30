import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '../../api/client'
import { useAuth } from './AuthContext'
import { Button, ErrorBanner, TextField } from '../../components/ui'
import { email } from '../../lib/validation'
import { AuthShell } from './AuthShell'

const schema = z.object({ email, password: z.string().min(1, 'Enter your password') })
type Form = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await login(values.email, values.password)
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    }
  })

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to keep tracking your footprint.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={error} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="text-sm">
        <Link className="text-accent underline" to="/forgot-password">
          Forgot password?
        </Link>
        {' · '}
        <Link className="text-accent underline" to="/register">
          Create account
        </Link>
      </p>
    </AuthShell>
  )
}
