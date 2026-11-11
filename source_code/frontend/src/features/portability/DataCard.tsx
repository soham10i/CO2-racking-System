import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, download } from '../../api/client'
import type { ImportResult, ImportRowStatus } from '../../api/types'
import { errorMessage } from '../../app/queryClient'
import { useToast } from '../../components/Toast'
import { Button, Card, ErrorBanner, SelectField } from '../../components/ui'
import { formatKg, shortDate, unitLabel } from '../../lib/format'
import { queryKeys } from '../../lib/queryKeys'

const MAX_BYTES = 1_000_000

const STATUS: Record<ImportRowStatus, { label: string; className: string }> = {
  READY: { label: 'Ready', className: 'bg-brand text-brand-ink' },
  IMPORTED: { label: 'Imported', className: 'bg-primary text-primary-ink' },
  DUPLICATE: { label: 'Skipped', className: 'bg-fill text-muted' },
  ERROR: { label: 'Error', className: 'bg-danger/10 text-danger' },
}

type Mode = 'log' | 'meter'
type MeterType = 'ELECTRICITY' | 'NATURAL_GAS' | 'DISTRICT_HEATING'

const meterTypes: { value: MeterType; label: string }[] = [
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'NATURAL_GAS', label: 'Natural gas' },
  { value: 'DISTRICT_HEATING', label: 'District heating' },
]

const importCsv = (csv: string, dryRun: boolean, mode: Mode, subtype: MeterType) =>
  mode === 'log'
    ? api<ImportResult>('/activities/import', { method: 'POST', body: { csv, dryRun } })
    : api<ImportResult>('/activities/import/meter', { method: 'POST', body: { csv, subtype, dryRun } })

/** Export everything (JSON) or the log (CSV), and import a CSV after a row-by-row preview. */
export function DataCard() {
  const toast = useToast()
  const client = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'json' | 'csv' | 'check' | 'import' | null>(null)
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('log')
  const [subtype, setSubtype] = useState<MeterType>('ELECTRICITY')

  /** A different kind of file means a fresh preview. */
  function reset() {
    setResult(null)
    setError(null)
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function exportAs(kind: 'json' | 'csv') {
    setBusy(kind)
    try {
      await download(kind === 'json' ? '/me/export' : '/activities/export', `co2-tracker.${kind}`)
    } catch (e) {
      toast({ message: errorMessage(e, 'Export failed') ?? 'Export failed', tone: 'error' })
    } finally {
      setBusy(null)
    }
  }

  async function pick(f: File | undefined) {
    setResult(null)
    setError(null)
    setFile(null)
    if (!f) return
    if (f.size > MAX_BYTES) {
      setError('That file is over 1 MB. Split it into smaller files.')
      return
    }
    const text = await f.text()
    setFile({ name: f.name, text })
    setBusy('check')
    try {
      setResult(await importCsv(text, true, mode, subtype))
    } catch (e) {
      setError(errorMessage(e, 'Could not read that file'))
    } finally {
      setBusy(null)
    }
  }

  async function commit() {
    if (!file) return
    setBusy('import')
    try {
      const r = await importCsv(file.text, false, mode, subtype)
      setResult(r)
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.activities.all }),
        client.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      ])
      toast({ message: `Imported ${r.imported} ${r.imported === 1 ? 'entry' : 'entries'}` })
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch (e) {
      setError(errorMessage(e, 'Import failed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="space-y-6 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fill text-ink">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Your data</h2>
          <p className="text-sm text-muted">Download a copy any time, or bring entries over from a spreadsheet.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" className="justify-start rounded-2xl px-4 py-3" disabled={busy !== null} onClick={() => exportAs('json')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" /></svg>
          {busy === 'json' ? 'Preparing…' : 'Export everything (JSON)'}
        </Button>
        <Button variant="secondary" className="justify-start rounded-2xl px-4 py-3" disabled={busy !== null} onClick={() => exportAs('csv')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" /></svg>
          {busy === 'csv' ? 'Preparing…' : 'Export log (CSV)'}
        </Button>
      </div>

      <div className="border-t border-line pt-6">
        <h3 className="font-display text-base font-semibold tracking-tight">Import from CSV</h3>
        <div className="segmented mt-3 w-full sm:w-auto" role="group" aria-label="Kind of file">
          {(
            [
              ['log', 'Activity log'],
              ['meter', 'Meter or utility export'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="segment flex-1 sm:flex-none"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value)
                reset()
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'log' ? (
          <p className="mt-2 text-sm text-muted">
            Columns: <code>date</code> (YYYY-MM-DD), <code>category</code>, <code>subtype</code>, <code>quantity</code>, and
            optionally <code>passengers</code> and <code>note</code> — the CSV export has the same layout. Nothing is saved
            until you confirm.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-muted">
              From a smart meter app or your supplier portal, in kWh: a <code>date</code>/<code>Datum</code> column and
              either meter readings (<code>reading</code>/<code>Zählerstand</code>, booked as the difference to the day
              before) or consumption (<code>consumption</code>/<code>Verbrauch</code>, summed per day). Semicolons and
              decimal commas are fine. Nothing is saved until you confirm.
            </p>
            <SelectField
              label="Energy type"
              value={subtype}
              onChange={(e) => {
                setSubtype(e.target.value as MeterType)
                reset()
              }}
              options={meterTypes}
            />
          </div>
        )}
        <label className="mt-4 block rounded-2xl border-2 border-dashed border-field/60 bg-raised p-4 transition-colors hover:border-field">
          <span className="sr-only">CSV file</span>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            disabled={busy === 'import'}
            onChange={(e) => void pick(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:min-h-[44px] file:cursor-pointer file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-primary-ink hover:file:opacity-90 text-muted file:rounded-full"
          />
        </label>
        <div className="mt-3 space-y-3">
          <ErrorBanner message={error} />
          {busy === 'check' && <p role="status" className="text-sm text-muted">Checking rows…</p>}
          {result && <ImportPreview result={result} />}
          {result?.dryRun && file && result.ready > 0 && (
            <Button className="w-full sm:w-auto" disabled={busy !== null} onClick={commit}>
              {busy === 'import' ? 'Importing…' : `Import ${result.ready} ${result.ready === 1 ? 'entry' : 'entries'}`}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function ImportPreview({ result: r }: { result: ImportResult }) {
  const problems = r.rows.filter((x) => x.status === 'ERROR' || x.status === 'DUPLICATE')
  const rows = [...problems, ...r.rows.filter((x) => x.status !== 'ERROR' && x.status !== 'DUPLICATE')].slice(0, 50)
  return (
    <div className="space-y-2">
      <p role="status" className="text-sm tabular-nums">
        {r.dryRun ? (
          <>
            <strong>{r.ready}</strong> ready · {r.duplicates} already logged · {r.errors} with errors
          </>
        ) : (
          <>
            <strong>{r.imported}</strong> imported · {r.duplicates} skipped · {r.errors} with errors
          </>
        )}
      </p>
      <div className="max-h-72 overflow-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-raised text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Line</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Entry</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">kg CO2e</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((x, i) => (
              <tr key={`${x.line}-${i}`} className="transition-colors hover:bg-fill">
                <td className="px-3 py-2 tabular-nums text-muted">{x.line}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[x.status].className}`}>{STATUS[x.status].label}</span>
                </td>
                <td className="px-3 py-2">
                  {x.label ? (
                    <>
                      {x.label} · {x.quantity} {x.unit ? unitLabel(x.unit) : ''}
                      {x.date && <span className="text-muted"> · {shortDate(x.date)}</span>}
                    </>
                  ) : (
                    x.date && <span className="text-muted">{shortDate(x.date)}</span>
                  )}
                  {x.message && <span className="block text-xs text-muted">{x.message}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{x.kgCo2e !== undefined ? formatKg(x.kgCo2e) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.rows.length > rows.length && <p className="text-xs text-muted">Showing the first {rows.length} of {r.rows.length} rows, problems first.</p>}
    </div>
  )
}
