import { useState, type ReactNode } from 'react'
import { api, ApiError, logout } from '../../api/client'
import type { Me } from '../../api/types'
import { useAuth } from '../auth/AuthContext'
import { ProfileEditor } from './ProfileEditor'
import { DataCard } from '../portability/DataCard'
import { NotificationSettingsCard } from '../notifications/NotificationSettingsCard'
import { ThemeToggle } from '../../components/ThemeToggle'
import { accents, useAccent, useSolidSurfaces } from '../../lib/appearance'
import { Button, Card, ErrorBanner, TextField } from '../../components/ui'
import { locales, useT, type Locale } from '../../lib/i18n'

/** Section heading used by every settings card: title on the left, optional control on the right. */
function SectionHead({ title, hint, icon, tone = 'bg-fill text-ink', children }: { title: string; hint?: string; icon: string; tone?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

const ICON = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Zm7 4v2',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
}

function ChangePassword() {
  const { t } = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <Card className="p-6 md:p-8">
      <SectionHead title={t('settings.password')} icon={ICON.lock} />
      <form
        className="mt-6 space-y-5 border-t border-line pt-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setMsg(null)
          try {
            await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
            setCurrent('')
            setNext('')
            setMsg({ ok: true, text: t('settings.passwordChanged') })
          } catch (err) {
            setMsg({ ok: false, text: err instanceof ApiError ? (err.fieldErrors[0]?.message ?? err.message) : t('common.error') })
          }
        }}
      >
        {msg && !msg.ok && <ErrorBanner message={msg.text} />}
        {msg?.ok && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-fill px-4 py-3 text-sm font-medium text-ink">
            <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-ink">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </span>
            {msg.text}
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <TextField label={t('settings.currentPassword')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <TextField label={t('settings.newPassword')} type="password" autoComplete="new-password" hint={t('settings.passwordHint')} value={next} onChange={(e) => setNext(e.target.value)} required minLength={12} />
        </div>
        <div className="flex sm:justify-end">
          <Button type="submit" className="w-full sm:w-auto">{t('settings.updatePassword')}</Button>
        </div>
      </form>
    </Card>
  )
}

function DeleteAccount() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <Card className="border border-danger/40 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON.trash} /></svg>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-tight text-danger">{t('settings.delete')}</h2>
            <p className="mt-0.5 max-w-prose text-sm text-muted">{t('settings.deleteBody')}</p>
          </div>
        </div>
        {!open && (
          <Button variant="danger" className="w-full sm:w-auto" onClick={() => setOpen(true)}>{t('settings.deleteOpen')}</Button>
        )}
      </div>
      {open && (
        <form
          className="mt-6 space-y-5 border-t border-line pt-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            try {
              await api('/me', { method: 'DELETE', body: { password } })
              await logout()
            } catch (err) {
              setError(err instanceof ApiError ? err.message : t('common.error'))
            }
          }}
        >
          <ErrorBanner message={error} />
          <TextField label={t('settings.deleteConfirm')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" type="submit">{t('settings.deleteSubmit')}</Button>
          </div>
        </form>
      )}
    </Card>
  )
}

function Appearance() {
  const [accent, setAccent] = useAccent()
  const [solid, setSolid] = useSolidSurfaces()
  const { t } = useT()
  return (
    <Card className="p-6 md:p-8">
      <SectionHead title={t('settings.appearance')} hint={t('settings.appearanceHint')} icon={ICON.sun} tone="bg-brand text-brand-ink">
        <ThemeToggle className="w-full sm:w-72" />
      </SectionHead>
      <fieldset className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <legend className="sr-only">{t('settings.accent')}</legend>
        <div aria-hidden>
          <p className="font-medium">{t('settings.accent')}</p>
          <p className="text-sm text-muted">{t('settings.accentHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {accents.map((a) => (
            <label key={a.value} className="cursor-pointer">
              <input type="radio" name="accent" value={a.value} checked={accent === a.value} onChange={() => setAccent(a.value)} className="peer sr-only" />
              <span
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-field/60 bg-surface px-4 text-sm transition-colors hover:border-field peer-checked:border-ink peer-checked:font-semibold peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--ring)]"
              >
                <svg width="14" height="14" aria-hidden>
                  <circle cx="7" cy="7" r="6.25" fill={a.swatch} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
                </svg>
                {a.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 border-t border-line pt-5">
        <span>
          <span className="block font-medium">{t('settings.solid')}</span>
          <span className="block text-sm text-muted">{t('settings.solidHint')}</span>
        </span>
        <input type="checkbox" role="switch" checked={solid} onChange={(e) => setSolid(e.target.checked)} className="switch" />
      </label>
    </Card>
  )
}

function Language() {
  const { setUser } = useAuth()
  const { t, locale } = useT()
  const [error, setError] = useState<string | null>(null)
  async function choose(l: Locale) {
    setError(null)
    try {
      // Saved first: the account's language is what every signed-in device follows.
      setUser(await api<Me>('/me/preferences', { method: 'PATCH', body: { locale: l } }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'))
    }
  }
  return (
    <Card className="space-y-4 p-6 md:p-8">
      <SectionHead title={t('settings.language')} hint={t('settings.languageHint')} icon={ICON.globe}>
        <div className="segmented w-full sm:w-72" role="group" aria-label={t('settings.language')}>
          {locales.map((l) => (
            <button key={l.value} type="button" lang={l.value} className="segment flex-1" aria-pressed={locale === l.value} onClick={() => void choose(l.value)}>
              {l.label}
            </button>
          ))}
        </div>
      </SectionHead>
      <ErrorBanner message={error} />
    </Card>
  )
}

export default function Settings() {
  const { state, setUser } = useAuth()
  const { t } = useT()
  if (state.status !== 'authed') return null
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('settings.title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('settings.signedInAs', { email: state.user.email })}</p>
        </div>
        <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-primary font-display text-lg font-semibold text-primary-ink">
          {(state.user.profile.displayName || state.user.email).slice(0, 1).toUpperCase()}
        </span>
      </header>
      <Group label="General">
        <Appearance />
        <Language />
        <NotificationSettingsCard />
      </Group>
      <Group label="Profile">
      <ProfileEditor
        initial={state.user.profile}
        submitLabel={t('settings.saveProfile')}
        onSubmit={async (profile) => {
          const me = await api<Me>('/me/profile', { method: 'PUT', body: profile })
          setUser(me)
        }}
      />
      </Group>
      <Group label="Data">
        <DataCard />
      </Group>
      <Group label="Security">
        <ChangePassword />
        <DeleteAccount />
      </Group>
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p aria-hidden className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="space-y-4 md:space-y-5">{children}</div>
    </div>
  )
}
