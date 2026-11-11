import { useDeleteActivity, useSaveActivity } from './hooks'
import { errorMessage } from '../../app/queryClient'
import type { Activity, ActivityInput } from '../../api/types'
import { useToast } from '../../components/Toast'
import { localToday } from '../../lib/format'

/** The fields that recreate an entry; the server recomputes the emission from the current factor. */
export function toInput(a: Activity, occurredOn = a.occurredOn): ActivityInput {
  return {
    category: a.category,
    subtype: a.subtype,
    quantity: a.share ? a.share.totalQuantity : a.quantity,
    passengers: a.passengers,
    occurredOn,
    ...(a.note ? { note: a.note } : {}),
    ...(a.share ? { shareWithHousehold: true } : {}),
  }
}

/**
 * Toasts for activity writes. Every write is applied straight away and offers Undo instead of asking
 * first: undoing a create deletes it, undoing a delete creates the same entry again.
 */
export function useActivityToasts() {
  const toast = useToast()
  const save = useSaveActivity()
  const del = useDeleteActivity()

  const failed = (e: unknown, fallback: string) => toast({ tone: 'error', message: errorMessage(e, fallback) ?? fallback })

  function created(a: Activity, message: string) {
    toast({
      message,
      action: {
        label: 'Undo',
        run: () => del.mutateAsync(a.id).then(() => toast({ message: 'Entry removed' }), (e) => failed(e, 'Could not undo')),
      },
    })
  }

  function deleted(a: Activity, message = `Deleted ${a.label}`) {
    toast({
      message,
      action: {
        label: 'Undo',
        run: () => save.mutateAsync({ input: toInput(a) }).then(() => toast({ message: 'Entry restored' }), (e) => failed(e, 'Could not restore the entry')),
      },
    })
  }

  async function logAgain(a: Activity) {
    try {
      created(await save.mutateAsync({ input: toInput(a, localToday()) }), `Logged ${a.label} for today`)
      return true
    } catch (e) {
      failed(e, 'Could not log the entry again')
      return false
    }
  }

  async function remove(a: Activity) {
    try {
      await del.mutateAsync(a.id)
      deleted(a)
      return true
    } catch (e) {
      failed(e, 'Could not delete the entry')
      return false
    }
  }

  return { created, deleted, failed, logAgain, remove, pending: save.isPending || del.isPending }
}
