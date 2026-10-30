import type { AuthResponse, FieldProblem } from './types'

const BASE = '/api/v1'

/** Held in memory only: never localStorage, so XSS cannot lift a long-lived credential. */
let accessToken: string | null = null
let refreshInFlight: Promise<AuthResponse | null> | null = null
let sessionListener: ((session: AuthResponse | null) => void) | null = null

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: FieldProblem[] = [],
  ) {
    super(message)
  }
}

export function onSessionChange(listener: ((session: AuthResponse | null) => void) | null) {
  sessionListener = listener
}

function send(path: string, method: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return fetch(BASE + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function toError(res: Response): Promise<ApiError> {
  let problem: { code?: string; detail?: string; errors?: FieldProblem[] } = {}
  try {
    problem = await res.json()
  } catch {
    /* empty or non-JSON body */
  }
  return new ApiError(res.status, problem.code ?? 'error', problem.detail ?? res.statusText, problem.errors ?? [])
}

function applySession(session: AuthResponse | null) {
  accessToken = session?.accessToken ?? null
  sessionListener?.(session)
}

/** Single-flight: concurrent 401s share one refresh so the rotating token is never replayed. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await send('/auth/refresh', 'POST')
      if (!res.ok) {
        applySession(null)
        return null
      }
      const session = (await res.json()) as AuthResponse
      applySession(session)
      return session
    } catch {
      applySession(null)
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export async function api<T = void>(
  path: string,
  opts: { method?: string; body?: unknown; retryOn401?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, retryOn401 = true } = opts
  let res = await send(path, method, body)
  if (res.status === 401 && retryOn401 && (await refreshSession())) {
    res = await send(path, method, body)
  }
  if (!res.ok) throw await toError(res)
  if (res.status === 204 || res.status === 202) return undefined as T
  return (await res.json()) as T
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const session = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    retryOn401: false,
  })
  applySession(session)
  return session
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST', retryOn401: false })
  } finally {
    applySession(null)
  }
}
