import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import { Button, Card, ErrorBanner, TextField } from '../../components/ui'
import { formatKg } from '../../lib/format'
import { useT } from '../../lib/i18n'

export interface Scope2 {
  from: string
  to: string
  kwh: number
  locationKg: number
  locationGPerKwh?: number | null
  supplierGPerKwh?: number | null
  marketKg?: number | null
}

const key = (from: string, to: string) => ['analytics', 'scope2', { from, to }] as const

/**
 * Electricity counted two ways. The location-based figure (grid average) is what every total uses; the
 * market-based one (your supplier's label) is shown beside it and never replaces it.
 */
export function Scope2Card({ from, to }: { from: string; to: string }) {
  const { t } = useT()
  const client = useQueryClient()
  const { data } = useQuery({ queryKey: key(from, to), queryFn: () => api<Scope2>(`/insights/scope2?from=${from}&to=${to}`) })
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: (gramsPerKwh: number | null) => api<Scope2>('/insights/scope2/supplier', { method: 'PUT', body: { gramsPerKwh } }),
    onSuccess: () => {
      setDraft(null)
      return client.invalidateQueries({ queryKey: ['analytics', 'scope2'] })
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
  })

  if (!data) return null
  const value = draft ?? (data.supplierGPerKwh?.toString() ?? '')
  const parsed = value.trim() === '' ? null : Number(value.replace(',', '.'))
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 2000)

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t('scope2.title')}</h2>
        <p className="text-sm text-muted">{t('scope2.subtitle', { kwh: formatKg(data.kwh) })}</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-fill p-4">
          <dt className="text-sm font-medium text-muted">{t('scope2.location')}</dt>
          <dd className="mt-2 font-display text-4xl font-semibold tabular-nums tracking-tight">
            {formatKg(data.locationKg)} <span className="font-sans text-sm font-normal tracking-normal text-muted">{t('common.kg')}</span>
          </dd>
          <dd className="mt-1 text-xs text-muted">
            {data.locationGPerKwh != null ? t('scope2.locationNote', { g: data.locationGPerKwh }) : t('scope2.noKwh')}
          </dd>
        </div>
        <div className="rounded-2xl border border-dashed border-line p-4">
          <dt className="text-sm font-medium text-muted">{t('scope2.market')}</dt>
          <dd className="mt-2 font-display text-4xl font-semibold tabular-nums tracking-tight">
            {data.marketKg == null ? '–' : formatKg(data.marketKg)}{' '}
            <span className="font-sans text-sm font-normal tracking-normal text-muted">{t('common.kg')}</span>
          </dd>
          <dd className="mt-1 text-xs text-muted">
            {data.supplierGPerKwh == null ? t('scope2.marketUnset') : t('scope2.marketNote', { g: data.supplierGPerKwh })}
          </dd>
        </div>
      </dl>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          if (!invalid) save.mutate(parsed)
        }}
      >
        <div className="w-full sm:w-56">
          <TextField
            label={t('scope2.supplierLabel')}
            inputMode="decimal"
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            error={invalid ? t('scope2.invalid') : undefined}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={save.isPending || invalid}>
          {t('common.save')}
        </Button>
      </form>
      <ErrorBanner message={error} />
      <p className="text-xs text-muted">
        {t('scope2.footnote')}{' '}
        <Link to="/methodology" className="font-medium text-accent underline">
          {t('nav.methodology')}
        </Link>
      </p>
    </Card>
  )
}
