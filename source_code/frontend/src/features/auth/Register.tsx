import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { api, ApiError } from '../../api/client'
import { Button, ErrorBanner, TextField } from '../../components/ui'
import { email, newPassword } from '../../lib/validation'
import { AuthShell } from './AuthShell'
import { GoogleSignIn } from './GoogleSignIn'
import { useT, type MessageKey } from '../../lib/i18n'

const schema = z.object({
  displayName: z.string().trim().min(1, 'v.nameRequired').max(80),
  email,
  password: newPassword,
})
type Form = z.infer<typeof schema>

export default function Register() {
  const { t, locale } = useT()
  const tr = (m?: string) => (m ? t(m as MessageKey) : undefined)
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
      await api('/auth/register', { method: 'POST', body: { ...values, locale }, retryOn401: false })
      setSentTo(values.email)
    } catch (e) {
      setError(e instanceof ApiError ? (e.fieldErrors[0]?.message ?? e.message) : t('common.error'))
    }
  })

  if (sentTo) {
    return (
      <AuthShell title={t('register.sentTitle')}>
        <div className="flex items-start gap-4 rounded-2xl bg-fill p-4">
          <MailBadge />
          <p role="status" className="text-sm leading-relaxed">
            {t('register.sent', { email: sentTo })}
          </p>
        </div>
        <Link className="liquid-capsule inline-flex min-h-[46px] w-full items-center justify-center rounded-full px-5 text-sm font-semibold text-ink" to="/login">
          {t('common.backToSignIn')}
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('register.title')} subtitle={t('register.subtitle')}>
      <GoogleSignIn />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <ErrorBanner message={error} />
        <TextField label={t('common.name')} autoComplete="name" error={tr(errors.displayName?.message)} {...register('displayName')} />
        <TextField label={t('common.email')} type="email" autoComplete="email" error={tr(errors.email?.message)} {...register('email')} />
        <TextField
          label={t('common.password')}
          type="password"
          autoComplete="new-password"
          hint={t('register.passwordHint')}
          error={tr(errors.password?.message)}
          {...register('password')}
        />
        <Button type="submit" className="mt-2 w-full min-h-[48px] text-[15px]" disabled={isSubmitting}>
          {isSubmitting ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>
      <p className="border-t border-line pt-5 text-sm text-muted">
        {t('register.already')}{' '}
        <Link className="font-medium text-accent underline decoration-1 underline-offset-4 hover:decoration-2" to="/login">
          {t('register.signIn')}
        </Link>
      </p>
    </AuthShell>
  )
}

function MailBadge() {
  return (
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16v12H4V6Zm0 0 8 6 8-6" />
      </svg>
    </span>
  )
}
