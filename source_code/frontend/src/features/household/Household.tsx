import { useState, type FormEvent } from 'react'
import { createInvite, type Invite } from './api'
import { useChangeHousehold, useHousehold } from './hooks'
import { errorMessage } from '../../app/queryClient'
import { useToast } from '../../components/Toast'
import { Button, Card, EmptyState, ErrorBanner, Loading, SkeletonRows, TextField } from '../../components/ui'
import { shortDate } from '../../lib/format'
import { useT } from '../../lib/i18n'

export default function Household() {
  const { data, error, isPending } = useHousehold()
  const change = useChangeHousehold()
  const toast = useToast()
  const { t } = useT()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [rename, setRename] = useState<string | null>(null)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  async function run(c: Parameters<typeof change.mutateAsync>[0], done?: string) {
    setFailure(null)
    try {
      await change.mutateAsync(c)
      if (done) toast({ message: done })
      return true
    } catch (e) {
      setFailure(errorMessage(e, t('household.error')))
      return false
    }
  }

  async function newInvite() {
    setFailure(null)
    try {
      setInvite(await createInvite())
    } catch (e) {
      setFailure(errorMessage(e, t('household.error')))
    }
  }

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault()
    fn()
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('household.title')}</h1>
        <p className="mt-2 text-muted">{t('household.subtitle')}</p>
      </header>

      <ErrorBanner message={error ? errorMessage(error, t('household.loadError')) : failure} />

      {isPending ? (
        <Loading>
          <Card>
            <SkeletonRows rows={2} />
          </Card>
        </Loading>
      ) : !data ? (
        <>
          <EmptyState art="home" title={t('household.noneTitle')}>
            {t('household.noneBody')}
          </EmptyState>
          <div className="grid gap-4 sm:grid-cols-2 md:gap-5">
            <Card className="flex flex-col">
              <span aria-hidden className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-brand text-brand-ink"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg></span>
              <form className="mt-auto space-y-4" onSubmit={submit(() => void run({ kind: 'create', value: name.trim() }))}>
                <TextField label={t('household.name')} value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} />
                <Button type="submit" className="w-full" disabled={!name.trim() || change.isPending}>
                  {t('household.create')}
                </Button>
              </form>
            </Card>
            <Card className="flex flex-col">
              <span aria-hidden className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-fill text-ink"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 17l5-5-5-5M15 12H3M14 4h5v16h-5" /></svg></span>
              <form className="mt-auto space-y-4" onSubmit={submit(() => void run({ kind: 'join', value: code.trim() }))}>
                <TextField
                  label={t('household.code')}
                  value={code}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ABCDE-FGHJK"
                  className="font-mono uppercase tracking-widest"
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button type="submit" variant="secondary" className="w-full" disabled={code.trim().length < 10 || change.isPending}>
                  {t('household.join')}
                </Button>
              </form>
            </Card>
          </div>
        </>
      ) : (
        <>
          <Card className="space-y-6 p-6 md:p-8">
            {rename === null ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 11 12 4l8 7v9h-5v-6h-6v6H4v-9Z" /></svg></span>
                  <h2 className="min-w-0 truncate font-display text-2xl font-semibold tracking-tight md:text-3xl">{data.name}</h2>
                </div>
                <Button variant="ghost" onClick={() => setRename(data.name)}>
                  {t('household.rename')}
                </Button>
              </div>
            ) : (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={submit(() => void run({ kind: 'rename', value: rename.trim() }).then((ok) => ok && setRename(null)))}
              >
                <div className="min-w-0 flex-1">
                  <TextField label={t('household.name')} value={rename} maxLength={60} autoFocus onChange={(e) => setRename(e.target.value)} />
                </div>
                <Button type="submit" disabled={!rename.trim() || change.isPending}>
                  {t('common.save')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setRename(null)}>
                  {t('common.cancel')}
                </Button>
              </form>
            )}

            <section aria-labelledby="members">
              <h3 id="members" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {t('household.members', { count: data.members.length, max: data.maxMembers })}
              </h3>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {data.members.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-center gap-3 font-medium">
                      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${m.me ? 'bg-primary text-primary-ink' : 'bg-fill text-ink'}`}>
                        {m.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate">
                      {m.displayName}
                      {m.me && <span className="text-muted"> ({t('household.you')})</span>}
                      </span>
                    </span>
                    {m.role === 'OWNER' && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink">{t('household.owner')}</span>}
                  </li>
                ))}
              </ul>
            </section>

            {data.members.length < data.maxMembers && (
              <div className={`space-y-3 rounded-2xl p-5 ${invite ? 'bg-brand text-brand-ink' : 'border border-dashed border-field/60'}`}>
                {invite ? (
                  <>
                    <p className="font-mono text-3xl font-semibold tracking-widest tabular-nums md:text-4xl" aria-label={t('household.code')}>
                      {invite.code}
                    </p>
                    <p className="text-sm opacity-80">{t('household.inviteNote', { date: shortDate(invite.expiresAt.slice(0, 10)) })}</p>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void navigator.clipboard?.writeText(invite.code).then(() => toast({ message: t('household.copied') }))
                      }
                    >
                      {t('household.copy')}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => void newInvite()}>
                    {t('household.invite')}
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-prose text-sm text-muted">{t('household.how')}</p>
            <Button
              variant="ghost"
              className="shrink-0 border border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
              disabled={change.isPending}
              onClick={() => {
                if (window.confirm(t('household.leaveConfirm'))) void run({ kind: 'leave' }, t('household.left'))
              }}
            >
              {t('household.leave')}
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}
