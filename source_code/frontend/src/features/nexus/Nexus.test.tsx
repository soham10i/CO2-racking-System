import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../lib/i18n'
import Nexus from './Nexus'

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <Nexus />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function route(url: string, init?: RequestInit) {
  if (url.endsWith('/nexus/status')) return json({ enabled: true })
  if (url.endsWith('/nexus/conversations')) return json([{ id: 'c1', title: 'Old chat', updatedAt: '2026-11-01T10:00:00Z' }])
  if (url.endsWith('/nexus/memory')) return json({ notes: '- Has no car', autoUpdate: true })
  if (url.endsWith('/nexus/chat'))
    return json({
      conversationId: 'c2',
      userMessage: { id: 'u1', role: 'user', content: JSON.parse(String(init?.body)).message },
      reply: { id: 'a1', role: 'assistant', content: 'Take the train.' },
    })
  if (url.includes('/rating')) return json(null, 204)
  return json({}, 404)
}

describe('Nexus', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(route)
    vi.stubGlobal('fetch', fetchMock)
  })

  it('sends one message, shows the answer, history and memory, and rates it', async () => {
    renderPage()
    expect(await screen.findByText('Old chat')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('- Has no car')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Ask Nexus/), { target: { value: 'Train or car?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Take the train.')).toBeInTheDocument()
    const chat = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/nexus/chat'))!
    expect(JSON.parse(chat[1].body)).toEqual({ message: 'Train or car?' })

    fireEvent.click(screen.getByRole('button', { name: 'Helpful' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/nexus/messages/a1/rating'))).toBe(true))
    expect(await screen.findByText(/Thanks/)).toBeInTheDocument()
  })

  it('shows the not-configured notice', async () => {
    fetchMock.mockImplementation(() => json({ enabled: false }))
    renderPage()
    await waitFor(() => expect(screen.getByText(/not set up/)).toBeInTheDocument())
  })
})
