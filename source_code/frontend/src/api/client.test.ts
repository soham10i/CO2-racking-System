import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, login, refreshSession } from './client'

const session = (token: string) => ({ accessToken: token, expiresIn: 900, user: { id: '1' } })
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('api client', () => {
  const fetchMock = vi.fn()
  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('refreshes once on 401 and retries the original request with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { detail: 'expired' }))
      .mockResolvedValueOnce(json(200, session('new-token')))
      .mockResolvedValueOnce(json(200, { ok: true }))

    await expect(api('/me')).resolves.toEqual({ ok: true })

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/v1/me', '/api/v1/auth/refresh', '/api/v1/me'])
    expect((fetchMock.mock.calls[2]![1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer new-token' })
  })

  it('shares a single refresh between concurrent callers', async () => {
    fetchMock.mockImplementation(async () => json(200, session('t')))
    await Promise.all([refreshSession(), refreshSession(), refreshSession()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not try to refresh when login itself fails', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { detail: 'Invalid email or password', code: 'unauthorized' }))
    await expect(login('a@b.c', 'x')).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces field errors from problem+json', async () => {
    fetchMock.mockResolvedValueOnce(json(422, { detail: 'Validation failed', code: 'validation', errors: [{ field: 'password', message: 'too short' }] }))
    await expect(api('/x', { method: 'POST', body: {}, retryOn401: false })).rejects.toMatchObject({
      status: 422,
      fieldErrors: [{ field: 'password', message: 'too short' }],
    })
  })
})
