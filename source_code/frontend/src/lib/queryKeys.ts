import type { Granularity } from '../api/types'
import type { ActivityQuery } from '../features/activities/api'

/**
 * Query-key factory: one place defines the cache hierarchy, so invalidating a prefix
 * (e.g. every analytics query after an activity changes) can never miss a key.
 */
export const queryKeys = {
  factors: (category?: string) => ['factors', category ?? 'all'] as const,
  activities: {
    all: ['activities'] as const,
    list: (q: ActivityQuery) => ['activities', 'list', q] as const,
    detail: (id: string) => ['activities', 'detail', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    summary: () => ['analytics', 'summary'] as const,
    trend: (q: { from?: string; to?: string; granularity: Granularity }) => ['analytics', 'trend', q] as const,
    compare: (q: { from?: string; to?: string }) => ['analytics', 'compare', q] as const,
    benchmarks: () => ['analytics', 'benchmarks'] as const,
    goal: () => ['analytics', 'goal'] as const,
    actions: () => ['analytics', 'actions'] as const,
  },
  templates: ['templates'] as const,
  baseline: ['baseline'] as const,
  household: ['household'] as const,
  plan: {
    all: ['plan'] as const,
    today: () => ['plan', 'today'] as const,
    grid: () => ['plan', 'grid'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => ['notifications', 'list'] as const,
    settings: () => ['notifications', 'settings'] as const,
  },
}
