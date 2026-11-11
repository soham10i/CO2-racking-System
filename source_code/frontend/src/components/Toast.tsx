import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastOptions {
  message: string
  tone?: 'success' | 'error'
  /** Shown as a button; a toast with an action stays longer so there is time to reach it. */
  action?: { label: string; run: () => unknown }
}

interface ToastItem extends ToastOptions {
  id: number
}

const ToastContext = createContext<((t: ToastOptions) => void) | null>(null)

/** `toast({ message, action: { label: 'Undo', run } })`. */
export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside ToastProvider')
  return show
}

const MAX_VISIBLE = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), [])
  const show = useCallback((t: ToastOptions) => {
    const id = nextId.current++
    setItems((all) => [...all, { ...t, id }].slice(-MAX_VISIBLE))
  }, [])

  const value = useMemo(() => show, [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Always mounted, so screen readers announce toasts added later. */}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [paused, setPaused] = useState(false)
  const ms = item.action ? 7000 : 4000
  // The parent re-renders whenever any toast changes; a ref keeps this timer from restarting each time.
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => close.current(), ms)
    return () => clearTimeout(timer)
  }, [paused, ms])

  const error = item.tone === 'error'
  return (
    <div
      role={error ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-1.5 text-sm text-ink shadow-[0_12px_32px_-12px_var(--glass-shadow)]"
    >
      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${error ? 'bg-danger text-danger-ink' : 'bg-brand text-brand-ink'}`}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {error ? <path d="M12 8v5m0 3h.01" /> : <path d="m5 12 5 5 9-10" />}
        </svg>
      </span>
      <p className="min-w-0 flex-1 py-1.5 font-medium">{item.message}</p>
      {item.action && (
        <button
          type="button"
          className="min-h-[36px] shrink-0 rounded-full bg-primary px-4 font-semibold text-primary-ink transition hover:opacity-90 active:scale-95"
          onClick={() => {
            onClose()
            void item.action!.run()
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-fill" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}
