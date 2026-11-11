import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { defaultQuantity, parseQuickLog, type QuickLogMatch } from './parse'
import { CategoryTile } from '../activities/ActivityRow'
import { estimate } from '../activities/api'
import { useFactors, useSaveActivity } from '../activities/hooks'
import { useActivityToasts } from '../activities/undo'
import { useLogTemplate, useTemplates } from '../planning/hooks'
import { errorMessage } from '../../app/queryClient'
import { enqueue, isOffline } from '../offline/queue'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../../components/Toast'
import type { Estimate, Template } from '../../api/types'
import { formatKg, localToday, unitLabel } from '../../lib/format'

const OpenContext = createContext<() => void>(() => {})

/** Opens the quick-log bar from anywhere inside the app shell (the "+" buttons). */
export const useQuickLog = () => useContext(OpenContext)

type Option = { kind: 'template'; template: Template } | { kind: 'factor'; match: QuickLogMatch }

const EXAMPLES = ['train 40 km', 'beef meal', 'drove 12 km with 2', 'electricity 120 kwh', 'yesterday bus 8 km']

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** ⌘K / Ctrl+K anywhere opens the bar; the provider also renders it. */
export function QuickLogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const show = useCallback(() => setOpen(true), [])

  // The installed app's "Quick log" shortcut opens /?quicklog=1; drop the flag so a reload does not reopen it.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('quicklog') === '1') {
      url.searchParams.delete('quicklog')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      setOpen(true)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <OpenContext.Provider value={show}>
      {children}
      {open && <CommandBar onClose={() => setOpen(false)} />}
    </OpenContext.Provider>
  )
}

function CommandBar({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const listId = useId()
  const hintId = useId()
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [preview, setPreview] = useState<Estimate | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const factors = useFactors()
  const templates = useTemplates()
  const save = useSaveActivity()
  const logTemplate = useLogTemplate()
  const toasts = useActivityToasts()
  const toast = useToast()
  const { state } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const today = localToday()
  const date = /\byesterday\b/i.test(text) ? shiftDay(today, -1) : today
  const query = text.replace(/\b(yesterday|today)\b/gi, ' ')

  const options: Option[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const named = (templates.data ?? [])
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((template) => ({ kind: 'template' as const, template }))
    const matched = parseQuickLog(query, factors.data ?? []).map((match) => ({ kind: 'factor' as const, match }))
    return [...named, ...matched]
  }, [query, templates.data, factors.data])

  const selected = options[Math.min(active, options.length - 1)]
  const sel = selected?.kind === 'factor' ? selected.match : null
  const qty = sel ? defaultQuantity(sel) : null
  const tooMuch = sel && qty !== null && qty > sel.factor.maxQuantity
  const input = sel && qty !== null && qty > 0 && !tooMuch
    ? { category: sel.factor.category, subtype: sel.factor.subtype, quantity: qty, occurredOn: date, passengers: sel.passengers ?? 1 }
    : null
  const inputKey = input ? JSON.stringify(input) : ''

  // The number shown before saving is the server's estimate, never computed here.
  useEffect(() => {
    setPreview(null)
    setPreviewError(null)
    if (!inputKey) return
    let cancelled = false
    const timer = setTimeout(() => {
      estimate(JSON.parse(inputKey)).then(
        (e) => !cancelled && setPreview(e),
        (e) => !cancelled && setPreviewError(errorMessage(e, 'Could not estimate')),
      )
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [inputKey])

  useEffect(() => setActive(0), [query])

  const busy = save.isPending || logTemplate.isPending

  async function submit() {
    if (!selected || busy) return
    try {
      if (selected.kind === 'template') {
        const a = await logTemplate.mutateAsync(selected.template.id)
        toasts.created(a, `Logged “${selected.template.name}” for today`)
      } else {
        if (!input) return
        const a = await save.mutateAsync({ input })
        toasts.created(a, `Logged ${formatKg(a.kgCo2e)} kg for ${a.label}${date !== today ? ' yesterday' : ''}`)
      }
      onClose()
    } catch (e) {
      if (selected.kind === 'factor' && input && isOffline(e) && state.status === 'authed') {
        enqueue(state.user.id, input)
        toast({ message: `Saved on this device: ${sel!.factor.label}. It syncs when you are back online.` })
        onClose()
      } else toasts.failed(e, 'Could not save the entry')
    }
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActive((i) => (i - 1 + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  let hint: string
  if (!query.trim()) hint = 'Type what you did, with an amount. Enter saves, Esc closes.'
  else if (!selected) hint = 'No match. Try a mode or food, e.g. “bus 8 km” or “vegan meal”.'
  else if (selected.kind === 'template') hint = `Logs your saved template for today (${formatKg(selected.template.kgCo2e)} kg).`
  else if (qty === null) hint = `Add an amount in ${unitLabel(sel!.factor.unit)}, e.g. “${sel!.factor.label.toLowerCase()} 10”.`
  else if (tooMuch) hint = `At most ${sel!.factor.maxQuantity} ${unitLabel(sel!.factor.unit)} per entry.`
  else if (previewError) hint = previewError
  else if (preview) hint = `${formatKg(preview.kgCo2e)} kg CO2e · ${qty} ${unitLabel(sel!.factor.unit)}${sel!.passengers ? ` shared by ${sel!.passengers}` : ''}${date !== today ? ' · yesterday' : ''}`
  else hint = 'Estimating…'

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label="Quick log"
      className="command-bar m-0 mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-card border border-line bg-surface p-0 text-ink shadow-[0_32px_80px_-24px_var(--glass-shadow)] max-md:mb-0 max-md:mt-auto max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <div aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={selected ? `${listId}-${Math.min(active, options.length - 1)}` : undefined}
          aria-describedby={hintId}
          aria-autocomplete="list"
          placeholder="train 40 km, beef meal, spent 30 €…"
          className="min-h-[56px] w-full border-none bg-transparent font-display text-lg font-medium tracking-tight text-ink outline-none placeholder:text-muted focus:outline-none focus:ring-0 focus-visible:outline-none sm:text-xl"
          enterKeyHint="done"
        />
        <kbd className="hidden shrink-0 items-center rounded-md border border-line bg-fill px-2 py-0.5 font-sans text-[11px] font-semibold text-muted sm:inline-flex">esc</kbd>
      </div>

      <ul id={listId} role="listbox" aria-label="Matches" className="max-h-[50vh] space-y-1 overflow-y-auto p-2 empty:hidden">
        {options.map((o, i) => {
          const isActive = selected === o
          const t = o.kind === 'template' ? o.template : null
          const f = o.kind === 'factor' ? o.match.factor : null
          return (
            <li
              key={t ? `t-${t.id}` : `f-${f!.subtype}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                setActive(i)
                if (isActive) void submit()
              }}
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 transition-colors duration-150 ${
                isActive ? 'border-ink bg-fill' : 'border-transparent hover:bg-fill'
              }`}
            >
              <CategoryTile category={(t ?? f)!.category} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t ? t.name : f!.label}</span>
                <span className="block text-xs text-muted">{t ? `Template · ${t.label}` : `per ${unitLabel(f!.unit).replace(/s$/, '')}`}</span>
              </span>
              {isActive && (
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-ink">
                  Enter ↵
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {!query.trim() && (
        <div className="px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="liquid-capsule group flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-fill-strong active:scale-95"
              >
                <span aria-hidden className="text-[10px] text-muted transition-colors group-hover:text-ink">✦</span>
                <span>{ex}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line bg-raised px-4 py-3 text-sm">
        <div id={hintId} aria-live="polite" className="min-w-0 flex-1">
          {preview && !previewError && !tooMuch ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 font-display text-sm font-semibold tabular-nums text-brand-ink">
                🌱 ≈ {formatKg(preview.kgCo2e)} kg CO2e
              </span>
              <span className="truncate text-xs text-muted">
                {qty} {unitLabel(sel!.factor.unit)}{sel!.passengers ? ` · ${sel!.passengers} people` : ''}{date !== today ? ' · yesterday' : ''}
              </span>
            </div>
          ) : (
            <p className={previewError || tooMuch ? 'text-xs font-medium text-danger' : 'text-xs text-muted'}>
              {hint}
            </p>
          )}
        </div>
        <button
          type="button"
          className="liquid-capsule flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink transition active:scale-95"
          onClick={() => {
            dialog.current?.close()
            navigate('/log/new')
          }}
        >
          <span>Full form</span>
          <span aria-hidden>→</span>
        </button>
      </div>
    </dialog>
  )
}
