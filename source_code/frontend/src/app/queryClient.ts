import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // A 4xx will not fix itself; only retry transient failures, once.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
      },
    },
  })
}

/** User-facing text for a failed query or mutation. */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string | null {
  if (!e) return null
  return e instanceof ApiError ? e.message : fallback
}
