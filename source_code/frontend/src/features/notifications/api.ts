import { api } from '../../api/client'

export type NotificationKind = 'BUDGET_AT_RISK' | 'BUDGET_OVER' | 'WEEKLY_DIGEST' | 'TEMPLATE_BOOKED' | 'HOUSEHOLD'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  createdAt: string
  read: boolean
}

export interface NotificationList {
  unread: number
  items: AppNotification[]
}

export interface NotificationSettings {
  budget: boolean
  templates: boolean
  digest: boolean
  pushAvailable: boolean
  vapidPublicKey: string | null
  pushDevices: number
}

export const listNotifications = () => api<NotificationList>('/notifications')
export const markRead = (id: string) => api(`/notifications/${id}/read`, { method: 'POST' })
export const markAllRead = () => api('/notifications/read-all', { method: 'POST' })
export const getNotificationSettings = () => api<NotificationSettings>('/notifications/settings')
export const saveNotificationSettings = (body: Partial<Pick<NotificationSettings, 'budget' | 'templates' | 'digest'>>) =>
  api<NotificationSettings>('/notifications/settings', { method: 'PUT', body })
export const subscribePush = (sub: PushSubscriptionJSON) => api('/notifications/push-subscriptions', { method: 'POST', body: sub })
export const unsubscribePush = (endpoint: string) => api('/notifications/push-subscriptions', { method: 'DELETE', body: { endpoint } })
