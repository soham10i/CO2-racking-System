import { useState } from 'react'
import { useActivityToasts } from './undo'
import type { Activity } from '../../api/types'

/** Repeats an entry for today with the same type, amount, passengers and note; the toast offers Undo. */
export function LogAgainButton({ activity: a, className }: { activity: Activity; className: string }) {
  const { logAgain } = useActivityToasts()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function again() {
    setBusy(true)
    const ok = await logAgain(a)
    setBusy(false)
    if (ok) {
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void again()}
      disabled={busy}
      className={`${className} ${done ? '!bg-brand !text-brand-ink' : 'hover:text-ink'}`}
      title={done ? 'Logged for today' : 'Log again today'}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {done ? <path d="m5 12 5 5 9-10" /> : <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15m0 5v-5h5" />}
      </svg>
      <span className="sr-only">{done ? `Logged ${a.label} for today` : `Log ${a.label} again today`}</span>
    </button>
  )
}
