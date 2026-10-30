import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TemplateInput } from '../../api/types'
import { queryKeys } from '../../lib/queryKeys'
import { createTemplate, deleteTemplate, getActions, getBaseline, getGoal, listTemplates, logTemplate, saveBaseline, setGoal, updateTemplate } from './api'

export const useTemplates = () => useQuery({ queryKey: queryKeys.templates, queryFn: listTemplates })

// Budget and actions are derived from activities, so they live under the analytics prefix and refresh with it.
export const useGoal = () => useQuery({ queryKey: queryKeys.analytics.goal(), queryFn: getGoal })

export const useActions = () => useQuery({ queryKey: queryKeys.analytics.actions(), queryFn: getActions })

export const useBaseline = () => useQuery({ queryKey: queryKeys.baseline, queryFn: async () => (await getBaseline()) ?? null })

/** Templates can book activities (one-tap log, recurring catch-up), so writes refresh activities too. */
function useInvalidateBookings() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.templates }),
      client.invalidateQueries({ queryKey: queryKeys.activities.all }),
      client.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ])
}

export function useSaveTemplate() {
  const invalidate = useInvalidateBookings()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TemplateInput }) => (id ? updateTemplate(id, input) : createTemplate(input)),
    onSuccess: invalidate,
  })
}

export function useDeleteTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.templates }),
  })
}

export function useLogTemplate() {
  const invalidate = useInvalidateBookings()
  return useMutation({ mutationFn: logTemplate, onSuccess: invalidate })
}

export function useSetGoal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: setGoal,
    onSuccess: (goal) => client.setQueryData(queryKeys.analytics.goal(), goal),
  })
}

export function useSaveBaseline() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: saveBaseline,
    onSuccess: (b) => client.setQueryData(queryKeys.baseline, b),
  })
}
