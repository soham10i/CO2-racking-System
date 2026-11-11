import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { Button, Card, ErrorBanner } from '../../components/ui'
import { useT, type MessageKey } from '../../lib/i18n'
import { askNexus, deleteConversation, getConversation, getNexusStatus, listConversations, rateMessage, type NexusMessage } from './api'
import { MemoryPanel } from './MemoryPanel'

const suggestions: MessageKey[] = ['nexus.s1', 'nexus.s2', 'nexus.s3']
const keys = {
  status: ['nexus', 'status'] as const,
  list: ['nexus', 'conversations'] as const,
  memory: ['nexus', 'memory'] as const,
}

export default function Nexus() {
  const { t } = useT()
  const client = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NexusMessage[]>([])
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const status = useQuery({ queryKey: keys.status, queryFn: getNexusStatus, staleTime: 5 * 60_000 })
  const history = useQuery({ queryKey: keys.list, queryFn: listConversations })

  const ask = useMutation({
    mutationFn: (text: string) => askNexus(text, conversationId),
    onSuccess: (r) => {
      setConversationId(r.conversationId)
      // Swap the optimistic question for the stored one, then append the answer.
      setMessages((m) => [...m.slice(0, -1), r.userMessage, r.reply])
      client.invalidateQueries({ queryKey: keys.list })
      client.invalidateQueries({ queryKey: keys.memory })
    },
  })

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [messages.length, ask.isPending])

  const open = async (id: string) => {
    ask.reset()
    const c = await getConversation(id)
    setConversationId(c.id)
    setMessages(c.messages)
  }
  const startNew = () => {
    ask.reset()
    setConversationId(null)
    setMessages([])
  }
  const remove = async (id: string) => {
    await deleteConversation(id)
    if (id === conversationId) startNew()
    client.invalidateQueries({ queryKey: keys.list })
  }

  const send = (text: string) => {
    const content = text.trim().slice(0, 2000)
    if (!content || ask.isPending) return
    setMessages((m) => [...m, { id: `pending-${m.length}`, role: 'user', content }])
    setDraft('')
    ask.mutate(content)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(draft)
    }
  }
  const setRating = (id: string, rating: number | null) =>
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, rating } : x)))

  const disabled = status.data?.enabled === false
  const error = ask.isError
    ? ask.error instanceof ApiError && ask.error.status === 429
      ? t('nexus.rateLimited')
      : t('nexus.error')
    : null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl space-y-1.5">
          <span className="mb-3 block h-1.5 w-10 rounded-full bg-brand" aria-hidden />
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t('nexus.title')}</h1>
          <p className="text-muted">{t('nexus.subtitle')}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" onClick={startNew}>
            {t('nexus.clear')}
          </Button>
        )}
      </header>

      {disabled ? (
        <ErrorBanner message={t('nexus.disabled')} />
      ) : (
        <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)]">
          <Card className="flex min-h-[60vh] flex-col gap-4 !p-4 md:!p-6">
            <div className="flex-1 space-y-4 overflow-y-auto" aria-live="polite" aria-busy={ask.isPending}>
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">{t('nexus.empty')}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => send(t(k))}
                        className="liquid-capsule rounded-full px-4 py-2 text-left text-sm text-ink transition active:scale-[0.98]"
                      >
                        {t(k)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] space-y-1.5">
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                        m.role === 'user' ? 'bg-primary text-primary-ink' : 'bg-fill text-ink'
                      }`}
                    >
                      <span className="sr-only">{m.role === 'user' ? t('nexus.you') : t('nexus.title')}: </span>
                      {m.content}
                    </div>
                    {m.role === 'assistant' && !m.id.startsWith('pending') && (
                      <Rating id={m.id} value={m.rating ?? null} onChange={(r) => setRating(m.id, r)} />
                    )}
                  </div>
                </div>
              ))}
              {ask.isPending && (
                <div className="flex justify-start" role="status">
                  <div className="flex items-center gap-1.5 rounded-2xl bg-fill px-4 py-3" aria-label={t('nexus.thinking')}>
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-brand" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {error && <ErrorBanner message={error} />}

            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <label htmlFor="nexus-input" className="sr-only">{t('nexus.placeholder')}</label>
              <textarea
                id="nexus-input"
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={t('nexus.placeholder')}
                className="block max-h-40 min-h-[48px] w-full resize-none rounded-xl border border-field/60 bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
              />
              <Button type="submit" disabled={!draft.trim() || ask.isPending}>
                {t('nexus.send')}
              </Button>
            </form>
            <p className="text-xs text-muted">{t('nexus.disclaimer')}</p>
          </Card>

          <div className="space-y-4 md:space-y-5">
            <Card className="space-y-3 !p-4 md:!p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">{t('nexus.history')}</h2>
              {history.data && history.data.length === 0 && <p className="text-sm text-muted">{t('nexus.noHistory')}</p>}
              <ul className="space-y-1">
                {history.data?.map((c) => (
                  <li key={c.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => open(c.id)}
                      aria-current={c.id === conversationId ? 'true' : undefined}
                      className={`min-h-[40px] flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-fill ${
                        c.id === conversationId ? 'bg-fill font-medium text-ink' : 'text-muted'
                      }`}
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      aria-label={`${t('nexus.delete')}: ${c.title}`}
                      className="grid h-9 w-9 place-items-center rounded-lg text-muted opacity-60 transition hover:bg-fill hover:text-danger group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <path d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <MemoryPanel />
          </div>
        </div>
      )}
    </div>
  )
}

function Rating({ id, value, onChange }: { id: string; value: number | null; onChange: (r: number | null) => void }) {
  const { t } = useT()
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const rate = async (r: -1 | 0 | 1, why?: string) => {
    await rateMessage(id, r, why)
    onChange(r === 0 ? null : r)
    setSent(r !== 0)
  }
  const thumb = (r: 1 | -1, label: string, d: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={value === r}
      onClick={() => {
        if (value === r) return rate(0)
        if (r === -1) setAsking(true)
        return rate(r)
      }}
      className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-fill ${value === r ? 'text-ink' : 'text-muted'}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={value === r ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  )
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
      {thumb(1, t('nexus.helpful'), 'M7 11v9H4v-9h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7')}
      {thumb(-1, t('nexus.notHelpful'), 'M17 13V4h3v9h-3Zm0 0-4 7a2 2 0 0 1-2-2v-3H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17')}
      {sent && !asking && <span>{t('nexus.thanks')}</span>}
      {asking && (
        <form
          className="flex w-full items-center gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault()
            rate(-1, note.trim() || undefined)
            setAsking(false)
          }}
        >
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('nexus.whyNot')}
            aria-label={t('nexus.whyNot')}
            className="min-h-[36px] flex-1 rounded-lg border border-field/60 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none"
          />
          <Button type="submit" variant="secondary" className="!min-h-[36px] !px-3 !py-1">
            {t('nexus.send')}
          </Button>
        </form>
      )}
    </div>
  )
}
