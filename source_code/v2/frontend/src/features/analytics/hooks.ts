import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Granularity } from '../../api/types'
import { queryKeys } from '../../lib/queryKeys'
import { getBenchmarks, getComparison, getSummary, getTrend } from './api'

export const useSummary = () => useQuery({ queryKey: queryKeys.analytics.summary(), queryFn: getSummary })

export const useTrend = (q: { from?: string; to?: string; granularity: Granularity }, enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.trend(q),
    queryFn: () => getTrend(q),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useComparison = (q: { from?: string; to?: string }) =>
  useQuery({ queryKey: queryKeys.analytics.compare(q), queryFn: () => getComparison(q), placeholderData: keepPreviousData })

export const useBenchmarks = () => useQuery({ queryKey: queryKeys.analytics.benchmarks(), queryFn: getBenchmarks })
