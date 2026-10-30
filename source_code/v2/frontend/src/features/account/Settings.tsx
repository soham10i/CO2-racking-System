import { useState } from 'react'
import { api, ApiError, logout } from '../../api/client'
import type { Me } from '../../api/types'
import { useAuth } from '../auth/AuthContext'
import { ProfileEditor } from './ProfileEditor'
import { Button, Card, ErrorBanner, TextField } from '../../components/ui'

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <Card>
      <h2 className="text-lg font-semibold">Change password</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setMsg(null)
          try {
            await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
            setCurrent('')
            setNext('')
            setMsg({ ok: true, text: 'Password changed. Other devices have been signed out.' })
          } catch (err) {
            setMsg({ ok: false, text: err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : 'Something went wrong.' })
          }
        }}
      >
        {msg && !msg.ok && <ErrorBanner message={msg.text} />}
        {msg?.ok && <p role="status" className="text-sm text-primary">{msg.text}</p>}
        <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." value={next} onChange={(e) => setNext(e.target.value)} required minLength={12} />
        <Button type="submit">Update password</Button>
      </form>
    </Card>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <Card className="border-danger">
      <h2 className="text-lg font-semibold text-danger">Delete account</h2>
      <p className="mt-1 text-sm text-muted">Permanently erases your account and all your data. This cannot be undone.</p>
      {!open ? (
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>Delete my account…</Button>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            try {
              await api('/me', { method: 'DELETE', body: { password } })
              await logout()
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Something went wrong.')
            }
          }}
        >
          <ErrorBanner message={error} />
          <TextField label="Confirm with your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="flex gap-2">
            <Button variant="danger" type="submit">Permanently delete</Button>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

export default function Settings() {
  const { state, setUser } = useAuth()
  if (state.status !== 'authed') return null
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="text-sm text-muted">Signed in as {state.user.email}</p>
      <ProfileEditor
        initial={state.user.profile}
        submitLabel="Save profile"
        onSubmit={async (profile) => {
          const me = await api<Me>('/me/profile', { method: 'PUT', body: profile })
          setUser(me)
        }}
      />
      <ChangePassword />
      <DeleteAccount />
    </div>
  )
}
