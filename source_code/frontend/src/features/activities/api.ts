import { api } from '../../api/client'
import type { Activity, ActivityInput, Category, Estimate, Factor, Page } from '../../api/types'

export const listFactors = (category?: Category) =>
  api<Factor[]>(`/emission-factors${category ? `?category=${category}` : ''}`)

export const estimate = (input: Omit<ActivityInput, 'note' | 'version'>) =>
  api<Estimate>('/calculator/estimate', { method: 'POST', body: input })

export const createActivity = (input: ActivityInput) => api<Activity>('/activities', { method: 'POST', body: input })

export const updateActivity = (id: string, input: ActivityInput) =>
  api<Activity>(`/activities/${id}`, { method: 'PUT', body: input })

export const getActivity = (id: string) => api<Activity>(`/activities/${id}`)

export const deleteActivity = (id: string) => api(`/activities/${id}`, { method: 'DELETE' })

export interface ActivityQuery {
  category?: Category | ''
  from?: string
  to?: string
  page?: number
  size?: number
}

export function listActivities(q: ActivityQuery = {}) {
  const params = new URLSearchParams()
  if (q.category) params.set('category', q.category)
  if (q.from) params.set('from', q.from)
  if (q.to) params.set('to', q.to)
  params.set('page', String(q.page ?? 0))
  params.set('size', String(q.size ?? 20))
  return api<Page<Activity>>(`/activities?${params}`)
}

