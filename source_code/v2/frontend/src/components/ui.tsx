import { Link, type LinkProps } from 'react-router-dom'
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: 'bg-primary text-primary-ink shadow-sm hover:brightness-110 active:brightness-95',
    secondary: 'bg-fill text-accent hover:bg-fill-strong',
    danger: 'bg-danger text-white hover:brightness-110',
  }[variant]
  return (
    <button
      {...props}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: LinkProps & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary' ? 'bg-primary text-primary-ink shadow-sm hover:brightness-110' : 'bg-fill text-accent hover:bg-fill-strong'
  return (
    <Link
      {...props}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${styles} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-card p-5 ${className}`}>{children}</section>
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
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-muted">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? msgId : undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={msgId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const control =
  'block min-h-[44px] w-full rounded-xl border border-field bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:border-2'

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string }
>(function TextField({ label, error, hint, ...props }, ref) {
  return (
    <FieldShell label={label} error={error} {...(hint ? { hint } : {})}>
      {({ id, describedBy, invalid }) => (
        <input ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid} className={control} {...props} />
      )}
    </FieldShell>
  )
})

export function SelectField({
  label,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  return (
    <FieldShell label={label}>
      {({ id }) => (
        <select id={id} className={control} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl border border-danger bg-surface px-3 py-2 text-sm font-medium text-danger">
      {message}
    </p>
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

/** App icon in the style of a system app: squircle-ish tile, vertical gradient, white glyph. */
export function AppIcon({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center shadow-sm"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2237,
        background: 'linear-gradient(180deg, #4cd964 0%, #1d9a43 100%)',
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
        <path d="M5 19 13 11" />
      </svg>
    </span>
  )
}
