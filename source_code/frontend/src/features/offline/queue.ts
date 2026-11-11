import type { ActivityInput } from '../../api/types'

/**
 * Entries saved while offline wait in this device's storage and are sent once the connection is back.
 * Each one is tagged with its user so a shared device never posts one person's entry into another account.
 * Only new entries are queued: edits need the current version and are not replayed.
 */
const KEY = 'co2.offlineQueue.v1'

export interface Queued {
  id: string
  userId: string
  input: ActivityInput
  queuedAt: string
}

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as Queued[]) : []
  } catch {
    return []
  }
}

function write(list: Queued[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the entry is lost, which the caller's toast already warns about */
  }
  window.dispatchEvent(new Event('co2-offline-queue'))
}

/** fetch() rejects with a TypeError when the network is unreachable; HTTP errors arrive as ApiError instead. */
export const isOffline = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)

export function enqueue(userId: string, input: ActivityInput) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  write([...read(), { id, userId, input, queuedAt: new Date().toISOString() }])
}

export const pendingFor = (userId: string) => read().filter((q) => q.userId === userId).length

/**
 * Sends this user's queued entries in order. A rejected entry (validation, e.g. a date that is now too old) is
 * dropped and counted; a network failure stops the run and keeps the rest for next time.
 */
export async function flush(userId: string, create: (input: ActivityInput) => Promise<unknown>) {
  let sent = 0
  let rejected = 0
  for (const item of read().filter((q) => q.userId === userId)) {
    try {
      await create(item.input)
      sent++
    } catch (e) {
      if (isOffline(e)) break
      rejected++
    }
    write(read().filter((q) => q.id !== item.id))
  }
  return { sent, rejected }
}
