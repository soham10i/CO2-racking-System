import { api } from '../../api/client'
import type { GridSignal, PlanEvent, TodayPlan } from '../../api/types'

export const getTodayPlan = () => api<TodayPlan>('/plan/today')

export const getGridSignal = () => api<GridSignal>('/grid/signal')

export const sendPlanFeedback = (key: string, event: PlanEvent, ifThen?: string) =>
  api(`/plan/cards/${encodeURIComponent(key)}/feedback`, { method: 'POST', body: ifThen ? { event, ifThen } : { event } })
