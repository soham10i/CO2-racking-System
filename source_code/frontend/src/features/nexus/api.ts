import { api } from '../../api/client'

export type NexusRole = 'user' | 'assistant'
export type NexusMessage = { id: string; role: NexusRole; content: string; rating?: number | null; createdAt?: string }
export type ConversationSummary = { id: string; title: string; updatedAt: string }
export type ConversationDetail = { id: string; title: string; messages: NexusMessage[] }
export type ChatResponse = { conversationId: string; userMessage: NexusMessage; reply: NexusMessage }
export type NexusMemory = { notes: string; autoUpdate: boolean; updatedAt?: string | null }

export const getNexusStatus = () => api<{ enabled: boolean }>('/nexus/status')
export const askNexus = (message: string, conversationId?: string | null) =>
  api<ChatResponse>('/nexus/chat', { method: 'POST', body: conversationId ? { conversationId, message } : { message } })
export const listConversations = () => api<ConversationSummary[]>('/nexus/conversations')
export const getConversation = (id: string) => api<ConversationDetail>(`/nexus/conversations/${encodeURIComponent(id)}`)
export const deleteConversation = (id: string) => api(`/nexus/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const rateMessage = (id: string, rating: -1 | 0 | 1, note?: string) =>
  api(`/nexus/messages/${encodeURIComponent(id)}/rating`, { method: 'POST', body: note ? { rating, note } : { rating } })
export const getMemory = () => api<NexusMemory>('/nexus/memory')
export const saveMemory = (notes: string, autoUpdate: boolean) =>
  api<NexusMemory>('/nexus/memory', { method: 'PUT', body: { notes, autoUpdate } })
export const forgetMemory = () => api('/nexus/memory', { method: 'DELETE' })
