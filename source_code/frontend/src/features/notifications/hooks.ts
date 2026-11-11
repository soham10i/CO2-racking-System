import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import { getNotificationSettings, listNotifications, markAllRead, markRead } from './api'

/** Polled once a minute while the tab is visible; budget alerts are raised server-side after a log. */
export const useNotifications = () =>
  useQuery({ queryKey: queryKeys.notifications.list(), queryFn: listNotifications, refetchInterval: 60_000 })

export const useNotificationSettings = () =>
  useQuery({ queryKey: queryKeys.notifications.settings(), queryFn: getNotificationSettings })

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) => (id ? markRead(id) : markAllRead()),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
  })
}
