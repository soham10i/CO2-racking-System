import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueue, flush, pendingFor } from './queue'
import type { ActivityInput } from '../../api/types'

const input = (q: number): ActivityInput => ({ category: 'TRANSPORT', subtype: 'BUS', quantity: q, occurredOn: '2026-10-30', passengers: 1 })

describe('offline queue', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('navigator', { onLine: true })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps entries per user and sends them in order', async () => {
    enqueue('a', input(1))
    enqueue('b', input(2))
    enqueue('a', input(3))
    expect(pendingFor('a')).toBe(2)
    const sent: number[] = []
    const r = await flush('a', async (i) => void sent.push(i.quantity))
    expect(r).toEqual({ sent: 2, rejected: 0 })
    expect(sent).toEqual([1, 3])
    expect(pendingFor('a')).toBe(0)
    expect(pendingFor('b')).toBe(1)
  })

  it('stops on a network error and drops rejected entries', async () => {
    enqueue('a', input(1))
    enqueue('a', input(2))
    let calls = 0
    const r = await flush('a', async () => {
      calls++
      if (calls === 1) throw new Error('422')
      throw new TypeError('Failed to fetch')
    })
    expect(r).toEqual({ sent: 0, rejected: 1 })
    expect(pendingFor('a')).toBe(1)
  })
})
