import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlanEvent } from '../../api/types'
import { queryKeys } from '../../lib/queryKeys'
import { getGridSignal, getTodayPlan, sendPlanFeedback } from './api'

// The server caches the grid signal for 15 minutes, so refetching more often gains nothing.
export const useTodayPlan = () => useQuery({ queryKey: queryKeys.plan.today(), queryFn: getTodayPlan, staleTime: 5 * 60_000 })

export const useGridSignal = () => useQuery({ queryKey: queryKeys.plan.grid(), queryFn: getGridSignal, staleTime: 15 * 60_000 })

/** Feedback reshuffles the ranking (and DONE reveals the next card), so the plan is refetched. */
export function usePlanFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ key, event, ifThen }: { key: string; event: PlanEvent; ifThen?: string }) => sendPlanFeedback(key, event, ifThen),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.plan.all }),
  })
}
