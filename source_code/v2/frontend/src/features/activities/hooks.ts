import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ActivityInput } from '../../api/types'
import { queryKeys } from '../../lib/queryKeys'
import { createActivity, deleteActivity, getActivity, listActivities, listFactors, updateActivity, type ActivityQuery } from './api'

export const useFactors = () =>
  useQuery({ queryKey: queryKeys.factors(), queryFn: () => listFactors(), staleTime: 10 * 60_000 })

export const useActivities = (q: ActivityQuery) =>
  useQuery({ queryKey: queryKeys.activities.list(q), queryFn: () => listActivities(q), placeholderData: keepPreviousData })

export const useActivity = (id: string | undefined) =>
  useQuery({ queryKey: queryKeys.activities.detail(id ?? ''), queryFn: () => getActivity(id!), enabled: Boolean(id) })

/** Any write changes lists and every derived figure, so both prefixes are invalidated. */
function useInvalidateAfterWrite() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.activities.all }),
      client.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ])
}

export function useSaveActivity() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ActivityInput }) =>
      id ? updateActivity(id, input) : createActivity(input),
    onSuccess: invalidate,
  })
}

export function useDeleteActivity() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (id: string) => deleteActivity(id), onSuccess: invalidate })
}
