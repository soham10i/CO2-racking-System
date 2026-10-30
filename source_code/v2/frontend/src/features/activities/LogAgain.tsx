import { useState } from 'react'
import { useSaveActivity } from './hooks'
import { errorMessage } from '../../app/queryClient'
import type { Activity } from '../../api/types'
import { localToday } from '../../lib/format'

/** Repeats an entry for today with the same type, amount, passengers and note. */
export function LogAgainButton({ activity: a, className, onError }: { activity: Activity; className: string; onError: (message: string) => void }) {
  const save = useSaveActivity()
  const [done, setDone] = useState(false)

  async function again() {
    try {
      await save.mutateAsync({
        input: {
          category: a.category,
          subtype: a.subtype,
          quantity: a.quantity,
          passengers: a.passengers,
          occurredOn: localToday(),
          ...(a.note ? { note: a.note } : {}),
        },
      })
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch (e) {
      onError(errorMessage(e, 'Could not log the entry again') ?? 'Could not log the entry again')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void again()}
      disabled={save.isPending}
      className={`${className} ${done ? 'text-primary' : 'hover:text-primary'}`}
      title={done ? 'Logged for today' : 'Log again today'}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {done ? <path d="m5 12 5 5 9-10" /> : <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15m0 5v-5h5" />}
      </svg>
      <span className="sr-only">{done ? `Logged ${a.label} for today` : `Log ${a.label} again today`}</span>
    </button>
  )
}
