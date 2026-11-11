import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listFactors, previewVersion, publishVersion, type AdminFactor, type FactorPreview, type VersionInput } from './api'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../../app/queryClient'
import { useToast } from '../../components/Toast'
import { Button, Card, ErrorBanner, Loading, SkeletonRows, TextField } from '../../components/ui'
import { categoryLabel, localToday } from '../../lib/format'

const key = ['admin', 'factors'] as const

/** Internal tool for maintainers, so it stays in English; the API refuses anyone without the ADMIN role. */
export default function AdminFactors() {
  const { state } = useAuth()
  const isAdmin = state.status === 'authed' && state.user.role === 'ADMIN'
  const { data, error, isPending } = useQuery({ queryKey: key, queryFn: listFactors, enabled: isAdmin })
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [history, setHistory] = useState(false)

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (data ?? []).filter(
      (f) => (history || f.current) && (!q || `${f.label} ${f.subtype} ${f.region ?? 'global'} ${f.sourceName}`.toLowerCase().includes(q)),
    )
  }, [data, filter, history])

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <span className="brand-chip">Admin</span>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Emission factors</h1>
        <p className="max-w-3xl text-muted">
          Publish a new version to change a factor. The current row closes the day the new one starts; entries already
          logged keep the factor they were calculated with.
        </p>
      </header>

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-[14rem] flex-1">
          <TextField label="Search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Label, subtype, region or source" />
        </div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-field/60 bg-surface px-4 text-sm font-medium transition-colors hover:border-field">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} className="switch" />
          Show earlier versions
        </label>
        {data && (
          <p aria-hidden className="ml-auto self-center text-sm text-muted tabular-nums">
            <span className="font-display text-2xl font-semibold text-ink">{rows.length}</span> / {data.length}
          </p>
        )}
      </Card>

      <ErrorBanner message={error ? errorMessage(error, 'Could not load factors') : null} />
      {isPending ? (
        <Loading label="Loading factors">
          <Card>
            <SkeletonRows rows={6} />
          </Card>
        </Loading>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Emission factors</caption>
            <thead className="border-b border-line bg-raised text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Factor</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Region</th>
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">kg CO2e / unit</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Valid</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Source</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((f) => (
                <FactorRow key={f.id} factor={f} open={editing === f.id} onToggle={() => setEditing(editing === f.id ? null : f.id)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">No factors match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function FactorRow({ factor: f, open, onToggle }: { factor: AdminFactor; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`transition-colors hover:bg-fill ${f.current ? '' : 'text-muted'} ${open ? 'bg-fill' : ''}`}>
        <td className="px-5 py-4">
          <p className="flex items-center gap-2 font-medium text-ink">
            {f.label}
            {!f.current && <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">v{f.version}</span>}
          </p>
          <p className="text-xs text-muted">
            {categoryLabel[f.category]} · {f.subtype} · v{f.version} · per {f.unit.toLowerCase()}
          </p>
        </td>
        <td className="px-4 py-4">{f.region ?? 'Global'}</td>
        <td className="px-4 py-4 text-right font-display text-base font-semibold tabular-nums tracking-tight text-ink">{f.kgCo2ePerUnit}</td>
        <td className="whitespace-nowrap px-4 py-4 tabular-nums">
          {f.validFrom} → {f.validTo ?? 'open'}
        </td>
        <td className="max-w-[16rem] px-4 py-4">
          {f.sourceUrl ? (
            <a href={f.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-accent underline decoration-1 underline-offset-4 hover:decoration-2">
              {f.sourceName}
            </a>
          ) : (
            f.sourceName
          )}
        </td>
        <td className="px-5 py-4 text-right">
          {f.current && (
            <Button variant="secondary" onClick={onToggle} aria-expanded={open}>
              {open ? 'Close' : 'New version'}
            </Button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="border-l-4 border-brand bg-fill px-5 py-6">
            <VersionForm factor={f} onDone={onToggle} />
          </td>
        </tr>
      )}
    </>
  )
}

function VersionForm({ factor: f, onDone }: { factor: AdminFactor; onDone: () => void }) {
  const client = useQueryClient()
  const toast = useToast()
  const tomorrow = new Date(`${localToday()}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const [value, setValue] = useState(String(f.kgCo2ePerUnit))
  const [from, setFrom] = useState(tomorrow.toISOString().slice(0, 10))
  const [source, setSource] = useState(f.sourceName)
  const [url, setUrl] = useState(f.sourceUrl ?? '')
  const [note, setNote] = useState(f.methodNote ?? '')
  const [preview, setPreview] = useState<FactorPreview | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const input = (): VersionInput => ({
    kgCo2ePerUnit: Number(value),
    validFrom: from,
    sourceName: source.trim(),
    ...(url.trim() ? { sourceUrl: url.trim() } : {}),
    ...(note.trim() ? { methodNote: note.trim() } : {}),
  })
  const valid = value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && from > f.validFrom && source.trim() !== ''

  const check = useMutation({ mutationFn: () => previewVersion(f.id, input()), onSuccess: setPreview })
  const publish = useMutation({
    mutationFn: () => publishVersion(f.id, input()),
    onSuccess: (next) => {
      void client.invalidateQueries({ queryKey: key })
      void client.invalidateQueries({ queryKey: ['factors'] })
      toast({ message: `Published ${next.label} v${next.version}` })
      onDone()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFailure(null)
    const action = preview ? publish : check
    action.mutateAsync().catch((err: unknown) => setFailure(errorMessage(err, 'Could not save the version')))
  }

  // Any edit invalidates the preview, so what gets published is always what was previewed.
  const edit = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value)
    setPreview(null)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label={`New version of ${f.label}`}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label={`kg CO2e per ${f.unit.toLowerCase()}`} inputMode="decimal" value={value} onChange={edit(setValue)} />
        <TextField label="Valid from" type="date" value={from} min={f.validFrom} onChange={edit(setFrom)} />
        <TextField label="Source" value={source} maxLength={120} onChange={edit(setSource)} />
        <TextField label="Source link (https)" type="url" value={url} maxLength={300} onChange={edit(setUrl)} />
      </div>
      <TextField label="Method note" value={note} maxLength={300} onChange={edit(setNote)} />
      <ErrorBanner message={failure} />
      {preview && (
        <div role="status" className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-display text-base font-semibold tabular-nums">
            v{f.version} → v{preview.nextVersion}: {preview.currentKgPerUnit} → {preview.newKgPerUnit} kg
            {preview.changePercent != null && ` (${preview.changePercent > 0 ? '+' : ''}${preview.changePercent}%)`}
          </p>
          <p className="mt-1 text-muted">
            v{f.version} ends on {preview.currentValidTo}. {preview.entriesFromValidFrom} entr
            {preview.entriesFromValidFrom === 1 ? 'y is' : 'ies are'} already dated from then on and keep v{f.version}.
          </p>
        </div>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || check.isPending || publish.isPending}>
          {preview ? 'Publish version' : 'Preview change'}
        </Button>
      </div>
    </form>
  )
}
