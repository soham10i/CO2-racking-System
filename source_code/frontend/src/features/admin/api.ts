import { api } from '../../api/client'
import type { Category } from '../../api/types'

export interface AdminFactor {
  id: string
  category: Category
  subtype: string
  label: string
  unit: string
  region?: string | null
  kgCo2ePerUnit: number
  sourceName: string
  sourceUrl?: string | null
  methodNote?: string | null
  validFrom: string
  validTo?: string | null
  version: number
  current: boolean
  createdAt?: string | null
}

export interface VersionInput {
  kgCo2ePerUnit: number
  validFrom: string
  sourceName: string
  sourceUrl?: string
  methodNote?: string
}

export interface FactorPreview {
  currentKgPerUnit: number
  newKgPerUnit: number
  changePercent?: number | null
  nextVersion: number
  currentValidTo: string
  entriesFromValidFrom: number
}

export const listFactors = () => api<AdminFactor[]>('/admin/factors')
export const previewVersion = (id: string, body: VersionInput) =>
  api<FactorPreview>(`/admin/factors/${id}/preview`, { method: 'POST', body })
export const publishVersion = (id: string, body: VersionInput) =>
  api<AdminFactor>(`/admin/factors/${id}/versions`, { method: 'POST', body })
