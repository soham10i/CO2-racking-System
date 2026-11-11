import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import { createHousehold, getHousehold, joinHousehold, leaveHousehold, renameHousehold } from './api'

export const useHousehold = () => useQuery({ queryKey: queryKeys.household, queryFn: getHousehold })

type Change = { kind: 'create' | 'rename' | 'join'; value: string } | { kind: 'leave' }

export function useChangeHousehold() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (c: Change) =>
      c.kind === 'leave'
        ? leaveHousehold().then(() => null)
        : c.kind === 'create'
          ? createHousehold(c.value)
          : c.kind === 'rename'
            ? renameHousehold(c.value)
            : joinHousehold(c.value),
    onSuccess: (h) => client.setQueryData(queryKeys.household, h),
  })
}
