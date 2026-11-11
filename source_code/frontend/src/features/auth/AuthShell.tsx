import type { ReactNode } from 'react'
import { AppIcon } from '../../components/ui'

/**
 * Split layout: a black brand panel on the left (desktop only) and the form card on the right.
 * The panel uses brand-ink (always black) with brand (always lime) text, so it reads the same in both themes.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <AppIcon size={40} />
            <p className="font-display text-xl font-semibold tracking-tight">CO2 Tracker</p>
          </div>
          <section className="glass-liquid rounded-card p-6 sm:p-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
            <div className="mt-6 space-y-5">{children}</div>
          </section>
        </div>
      </div>
    </main>
  )
}

function BrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden border-r border-line bg-brand-ink text-brand lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
    >
      <div className="relative z-10 flex items-center gap-3">
        <AppIcon size={44} />
        <p className="font-display text-2xl font-semibold tracking-tight">CO2 Tracker</p>
      </div>

      {/* Highlight graphic: concentric lime rings and a falling bar series. */}
      <svg viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2" fill="none">
        <circle cx="200" cy="200" r="190" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="140" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="90" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="40" fill="currentColor" />
        <path d="M200 10a190 190 0 0 1 164 95" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>

      <div className="relative z-10 max-w-md">
        <div className="mb-8 flex h-24 items-end gap-2">
          {[92, 78, 70, 58, 44, 34, 22].map((h, i) => (
            <span key={i} className="w-6 rounded-t-md bg-brand" style={{ height: `${h}%`, opacity: 0.35 + i * 0.1 }} />
          ))}
        </div>
        <p className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
          Measure it.
          <br />
          Shrink it.
        </p>
        <p className="mt-4 text-base opacity-80">Track your everyday footprint, set a budget and watch the line go down.</p>
      </div>
    </aside>
  )
}
