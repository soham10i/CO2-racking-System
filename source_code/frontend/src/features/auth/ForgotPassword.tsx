import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../../api/client'
import { Button, TextField } from '../../components/ui'
import { email } from '../../lib/validation'
import { AuthShell } from './AuthShell'
import { useT, type MessageKey } from '../../lib/i18n'

const schema = z.object({ email })
type Form = z.infer<typeof schema>

export default function ForgotPassword() {
  const { t } = useT()
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api('/auth/forgot-password', { method: 'POST', body: values, retryOn401: false })
    } finally {
      setDone(true) // identical outcome either way: never reveal whether the email exists
    }
  })

  return (
    <AuthShell title={t('forgot.title')}>
      {done ? (
        <div className="flex items-start gap-4 rounded-2xl bg-fill p-4">
          <DoneBadge />
          <p role="status" className="text-sm leading-relaxed">
            {t('forgot.done')}
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <TextField label={t('common.email')} type="email" autoComplete="email" error={errors.email && t(errors.email.message as MessageKey)} {...register('email')} />
          <Button type="submit" className="w-full min-h-[48px] text-[15px]" disabled={isSubmitting}>
            {t('forgot.submit')}
          </Button>
        </form>
      )}
      <Link className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline decoration-1 underline-offset-4 hover:decoration-2" to="/login">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
        {t('common.backToSignIn')}
      </Link>
    </AuthShell>
  )
}

function DoneBadge() {
  return (
    <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16v12H4V6Zm0 0 8 6 8-6" />
      </svg>
    </span>
  )
}
