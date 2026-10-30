import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../../api/client'
import { Button, TextField } from '../../components/ui'
import { email } from '../../lib/validation'
import { AuthShell } from './AuthShell'

const schema = z.object({ email })
type Form = z.infer<typeof schema>

export default function ForgotPassword() {
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
    <AuthShell title="Reset your password">
      {done ? (
        <p role="status" className="text-sm">
          If that email has an account, a reset link is on its way. It expires in 30 minutes.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <Link className="text-sm text-accent underline" to="/login">
        Back to sign in
      </Link>
    </AuthShell>
  )
}
