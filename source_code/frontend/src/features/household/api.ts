import { api } from '../../api/client'

export interface Member {
  displayName: string
  role: 'OWNER' | 'MEMBER'
  joinedAt: string
  me: boolean
}

export interface Household {
  id: string
  name: string
  members: Member[]
  maxMembers: number
}

export interface Invite {
  code: string
  expiresAt: string
}

/** 204 (not in a household) comes back as undefined; the query stores null so it counts as loaded. */
export const getHousehold = async () => (await api<Household | undefined>('/household')) ?? null
export const createHousehold = (name: string) => api<Household>('/household', { method: 'POST', body: { name } })
export const renameHousehold = (name: string) => api<Household>('/household', { method: 'PATCH', body: { name } })
export const createInvite = () => api<Invite>('/household/invites', { method: 'POST' })
export const joinHousehold = (code: string) => api<Household>('/household/join', { method: 'POST', body: { code } })
export const leaveHousehold = () => api('/household/leave', { method: 'POST' })
