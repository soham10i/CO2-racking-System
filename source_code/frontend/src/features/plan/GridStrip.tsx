import type { CSSProperties } from 'react'
import type { GridLevel, GridSignal } from '../../api/types'
import { currentLocale, useT } from '../../lib/i18n'

/** Local wall-clock time, e.g. 11:00, in the user's language. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat(currentLocale() === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

// Colour is never the only cue: each level also has its own pattern, and the legend and screen-reader list name it.
const levelStyle: Record<GridLevel, { className: string; style?: CSSProperties }> = {
  GREEN: { className: 'bg-accent' },
  YELLOW: { className: 'bg-warn', style: { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 3px, rgba(0,0,0,.28) 3px 5px)' } },
  RED: { className: 'bg-danger', style: { backgroundImage: 'radial-gradient(rgba(255,255,255,.6) 1px, transparent 1.4px)', backgroundSize: '5px 5px' } },
}

const levels: GridLevel[] = ['GREEN', 'YELLOW', 'RED']

function Swatch({ level }: { level: GridLevel }) {
  const s = levelStyle[level]
  return <span aria-hidden className={`inline-block h-3 w-4 rounded-sm ring-1 ring-inset ring-line ${s.className}`} style={s.style} />
}

/** 24 h of renewable share as bars (height = share), with the best window behind them as a lime band. */
export function GridStrip({ grid }: { grid: GridSignal }) {
  const { t } = useT()
  if (grid.source === 'FALLBACK' || grid.points.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-raised px-4 py-3 text-sm text-muted">
        <p>{t('plan.grid.fallback')}</p>
      </div>
    )
  }
  const pts = grid.points
  const first = new Date(pts[0]!.at).getTime()
  const last = new Date(pts[pts.length - 1]!.at).getTime()
  // Each point covers one step (15 min); the span runs to the end of the last step.
  const step = pts.length > 1 ? (last - first) / (pts.length - 1) : 15 * 60_000
  const span = last + step - first
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - first) / span) * 100))
  const w = grid.bestWindow
  const ticks = pts.filter((_, i) => i % Math.max(1, Math.round(pts.length / 6)) === 0)

  return (
    <div className="space-y-3">
      {w ? (
        <p className="text-sm">
          <span className="brand-chip mr-2 text-sm">{t('plan.grid.window', { from: clock(w.from), to: clock(w.to) })}</span>
          <span className="text-muted">{t('plan.grid.windowAvg', { share: Math.round(w.avgShare) })}</span>
        </p>
      ) : (
        <p className="text-sm text-muted">{t('plan.grid.noWindow')}</p>
      )}
      <div aria-hidden className="relative h-24 rounded-xl bg-fill">
        {w && (
          <div
            data-testid="best-window"
            className="absolute inset-y-0 rounded-lg bg-brand ring-1 ring-inset ring-line"
            style={{ left: `${pct(new Date(w.from).getTime())}%`, width: `${pct(new Date(w.to).getTime()) - pct(new Date(w.from).getTime())}%` }}
          />
        )}
        <div className="absolute inset-x-1 bottom-0 top-2 flex items-end gap-px">
          {pts.map((p) => {
            const s = levelStyle[p.level]
            return (
              <div
                key={p.at}
                className={`flex-1 rounded-t-sm ${s.className}`}
                style={{ height: `${Math.max(2, Math.min(100, p.renewableShare))}%`, ...s.style }}
              />
            )
          })}
        </div>
      </div>
      <div aria-hidden className="relative h-4 text-[11px] tabular-nums text-muted">
        {ticks.map((p) => (
          <span key={p.at} className="absolute -translate-x-1/2" style={{ left: `${pct(new Date(p.at).getTime())}%` }}>
            {clock(p.at)}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {pts.map((p) => (
          <li key={p.at}>{t('plan.grid.point', { time: clock(p.at), share: Math.round(p.renewableShare), level: t(`plan.grid.level.${p.level}`) })}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>{t('plan.grid.legend')}:</span>
        {levels.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <Swatch level={l} />
            {t(`plan.grid.level.${l}`)}
          </span>
        ))}
        {grid.substitute && <span>{t('plan.grid.substitute')}</span>}
      </div>
      <p className="text-xs text-muted">{t('plan.grid.attribution', { source: grid.attribution || 'Energy-Charts, Fraunhofer ISE' })}</p>
    </div>
  )
}
