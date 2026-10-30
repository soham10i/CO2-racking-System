import { api } from '../../api/client'
import type { Benchmarks, Comparison, Granularity, Summary, Trend } from '../../api/types'

function query(params: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const getSummary = () => api<Summary>('/dashboard/summary')

export const getTrend = (q: { from?: string; to?: string; granularity: Granularity }) =>
  api<Trend>(`/dashboard/trend${query(q)}`)

export const getComparison = (q: { from?: string; to?: string }) => api<Comparison>(`/dashboard/compare${query(q)}`)

export const getBenchmarks = () => api<Benchmarks>('/dashboard/benchmarks')
