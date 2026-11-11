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
import { GoogleSignIn } from './GoogleSignIn'
import { useT, type MessageKey } from '../../lib/i18n'

const schema = z.object({ email, password: z.string().min(1, 'v.passwordRequired') })
type Form = z.infer<typeof schema>

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useT()
  const tr = (m?: string) => (m ? t(m as MessageKey) : undefined)
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
      setError(e instanceof ApiError ? e.message : t('common.error'))
    }
  })

  return (
    <AuthShell title={t('login.title')} subtitle={t('login.subtitle')}>
      <GoogleSignIn />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <ErrorBanner message={error} />
        <TextField label={t('common.email')} type="email" autoComplete="email" error={tr(errors.email?.message)} {...register('email')} />
        <TextField label={t('common.password')} type="password" autoComplete="current-password" error={tr(errors.password?.message)} {...register('password')} />
        <Button type="submit" className="mt-2 w-full min-h-[48px] text-[15px]" disabled={isSubmitting}>
          {isSubmitting ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-5 text-sm">
        <Link className="font-medium text-accent underline decoration-1 underline-offset-4 hover:decoration-2" to="/forgot-password">
          {t('login.forgot')}
        </Link>
        <span aria-hidden className="text-muted">{' · '}</span>
        <Link className="font-medium text-accent underline decoration-1 underline-offset-4 hover:decoration-2" to="/register">
          {t('login.create')}
        </Link>
      </p>
    </AuthShell>
  )
}
