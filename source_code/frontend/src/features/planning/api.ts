import { api } from '../../api/client'
import type { Activity, Actions, DecisionStatus, Baseline, BaselineAnswers, Goal, Template, TemplateInput } from '../../api/types'

export const listTemplates = () => api<Template[]>('/templates')

export const createTemplate = (input: TemplateInput) => api<Template>('/templates', { method: 'POST', body: input })

export const updateTemplate = (id: string, input: TemplateInput) =>
  api<Template>(`/templates/${id}`, { method: 'PUT', body: input })

export const deleteTemplate = (id: string) => api(`/templates/${id}`, { method: 'DELETE' })

export const logTemplate = (id: string) => api<Activity>(`/templates/${id}/log`, { method: 'POST' })

export const getGoal = () => api<Goal>('/goals')

export const setGoal = (monthlyBudgetKg: number | null) => api<Goal>('/goals', { method: 'PUT', body: { monthlyBudgetKg } })

/** Resolves to undefined (204) until the questionnaire has been saved once. */
export const getBaseline = () => api<Baseline | undefined>('/baseline')

export const previewBaseline = (answers: BaselineAnswers) =>
  api<Baseline>('/baseline/estimate', { method: 'POST', body: answers })

export const saveBaseline = (answers: BaselineAnswers) => api<Baseline>('/baseline', { method: 'PUT', body: answers })

export const skipOnboarding = () => api('/onboarding/skip', { method: 'POST' })

export const getActions = () => api<Actions>('/insights/actions')

export const decideAction = (key: string, status: DecisionStatus, snoozeDays?: number) =>
  api<Actions>(`/insights/actions/${key}/decision`, { method: 'PUT', body: { status, snoozeDays } })

export const resetAction = (key: string) => api<Actions>(`/insights/actions/${key}/decision`, { method: 'DELETE' })
