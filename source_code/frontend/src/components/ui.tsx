import { Link, type LinkProps } from 'react-router-dom'
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-primary text-primary-ink hover:opacity-90 active:scale-[0.98]',
    secondary: 'liquid-capsule text-ink active:scale-[0.98]',
    danger: 'bg-danger text-danger-ink hover:opacity-90 active:scale-[0.98]',
    ghost: 'text-muted hover:bg-fill hover:text-ink active:scale-[0.98]',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: LinkProps & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'bg-primary text-primary-ink hover:opacity-90 active:scale-[0.98]'
      : 'liquid-capsule text-ink active:scale-[0.98]'
  return (
    <Link
      {...props}
      className={`inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ${styles} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass-liquid rounded-card p-6 ${className}`}>{children}</section>
}

interface FieldShellProps {
  label: string
  error?: string | undefined
  hint?: string
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? msgId : undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={msgId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const control =
  'block min-h-[48px] w-full rounded-xl border border-field/60 bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 hover:border-field focus:border-ink focus:outline-none focus:ring-4 focus:ring-[var(--ring)] aria-[invalid=true]:border-danger aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-danger/20'

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string }
>(function TextField({ label, error, hint, className = '', ...props }, ref) {
  return (
    <FieldShell label={label} error={error} {...(hint ? { hint } : {})}>
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={`${control} ${className}`}
          {...props}
        />
      )}
    </FieldShell>
  )
})

export function SelectField({
  label,
  options,
  error,
  hint,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: { value: string; label: string }[]
  error?: string
  hint?: string
}) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={`${control} appearance-none pr-10 cursor-pointer ${className}`}
            {...props}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value} className="bg-surface text-ink">
                {o.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted" aria-hidden>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}
    </FieldShell>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M12 8v5m0 3h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

/** A placeholder block; size and shape come from className. Hidden from assistive tech, the wrapper announces loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

/** Announces loading once while skeleton shapes hold the layout. */
export function Loading({ label = 'Loading', children, className = '' }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  )
}

/** List rows in the shape of ActivityRow: category tile, two text lines, a value. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-line" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-4 w-12" />
        </li>
      ))}
    </ul>
  )
}

/** A card holding a title line and a chart-sized block. */
export function SkeletonCard({ height = 'h-48', className = '' }: { height?: string; className?: string }) {
  return (
    <Card className={className}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className={`mt-4 w-full ${height}`} />
    </Card>
  )
}

/** Route-level fallback: a heading and two cards, so a page swap does not flash a blank screen. */
export function PageSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-5xl space-y-6 p-4 md:py-8">
      <Skeleton className="h-8 w-56" />
      <SkeletonCard />
      <SkeletonCard height="h-24" />
    </Loading>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-primary" aria-hidden />
      {label}…
    </div>
  )
}

/** App icon: lime tile, black leaf. */
export function AppIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center shadow-sm"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2237,
        background: '#0FFF4F',
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
        <path d="M5 19 13 11" />
      </svg>
    </span>
  )
}

const emptyArt: Record<'log' | 'template' | 'filter' | 'bell' | 'home', string> = {
  home: 'M4 11 12 4l8 7v9h-5v-6h-6v6H4v-9Z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4',
  log: 'M12 3c-4 3-6 6-6 9a6 6 0 0 0 12 0c0-3-2-6-6-9Zm0 18v-6m0 0-3-3m3 3 3-3',
  template: 'M6 4h12v16l-6-4-6 4V4Zm6 3v6m-3-3h6',
  filter: 'M4 5h16l-6 8v5l-4 2v-7L4 5Z',
}

/** A friendly empty screen: an illustration, one sentence and the next step, never a dead end. */
export function EmptyState({
  art,
  title,
  children,
  action,
}: {
  art: keyof typeof emptyArt
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <div className="relative mb-4 grid h-20 w-20 place-items-center" aria-hidden>
        <div className="absolute inset-0 rounded-full bg-[var(--fill)]" />
        <div className="absolute inset-3 rounded-full bg-brand/80" />
        <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-brand-ink" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={emptyArt[art]} />
        </svg>
      </div>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </Card>
  )
}
