import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanCard } from './PlanCard'
import { GridStrip } from './GridStrip'
import { ToastProvider } from '../../components/Toast'
import type { GridSignal, TodayPlan } from '../../api/types'

const grid: GridSignal = {
  source: 'ENERGY_CHARTS',
  substitute: false,
  points: [
    { at: '2026-11-09T10:00:00Z', renewableShare: 40, level: 'YELLOW' },
    { at: '2026-11-09T10:15:00Z', renewableShare: 65, level: 'GREEN' },
    { at: '2026-11-09T10:30:00Z', renewableShare: 20, level: 'RED' },
  ],
  bestWindow: { from: '2026-11-09T10:15:00Z', to: '2026-11-09T12:15:00Z', avgShare: 64.8 },
  attribution: 'Energy-Charts, Fraunhofer ISE',
}

const plan: TodayPlan = {
  date: '2026-11-09',
  cards: [
    {
      key: 'MEAL_SWAP',
      category: 'DIET',
      slot: 'MIDDAY',
      title: 'Make today’s beef meal vegetarian',
      detail: 'Swap one meal.',
      whyNow: 'You logged beef 6 times in the last 90 days.',
      saving: { lowKg: 2.1, highKg: 3, per: 'TODAY' },
      effort: 'LOW',
      ifThen: 'If it is lunchtime, then I choose the vegetarian option.',
      sources: [{ label: 'UBA / ifeu food factors', year: '2020' }],
      status: 'NEW',
      score: 0.71,
    },
    {
      key: 'COMMUTE_SWAP',
      category: 'TRANSPORT',
      slot: 'MORNING',
      title: 'Take the train to work',
      detail: 'One trip.',
      whyNow: 'You drove 12 km yesterday.',
      saving: { lowKg: 1, highKg: 1.4, per: 'TODAY' },
      effort: 'MEDIUM',
      ifThen: 'If I leave home, then I walk to the station.',
      sources: [],
      status: 'ADOPTED',
      score: 0.5,
    },
  ],
  grid,
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockApi() {
  const fn = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/plan/today')) return json(plan)
    if (url.includes('/plan/cards/')) return new Response(null, { status: 204 })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('PlanCard', () => {
  it('renders each card with slot, saving range, why-now and source', async () => {
    mockApi()
    wrap(<PlanCard />)
    const title = await screen.findByText('Make today’s beef meal vegetarian')
    const card = title.closest('li')!
    expect(within(card).getByText('Midday')).toBeInTheDocument()
    expect(within(card).getByText(/2\.1–3(\.0)? kg CO2e/)).toBeInTheDocument()
    expect(within(card).getByText('today')).toBeInTheDocument()
    expect(within(card).getByText('You logged beef 6 times in the last 90 days.')).toBeInTheDocument()
    expect(within(card).getByText(/UBA \/ ifeu food factors \(2020\)/)).toBeInTheDocument()
    expect(screen.getByText(/Cleanest window/)).toBeInTheDocument()
  })

  it('posts feedback and points at the next step after Done', async () => {
    const fetchMock = mockApi()
    wrap(<PlanCard />)
    const card = (await screen.findByText('Make today’s beef meal vegetarian')).closest('li')!
    await userEvent.click(within(card).getByRole('button', { name: 'Done' }))
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/plan/cards/MEAL_SWAP/feedback'))
      expect(JSON.parse(String(post?.[1]?.body))).toEqual({ event: 'DONE' })
    })
    expect(await screen.findByText('Done. Next step: Take the train to work')).toBeInTheDocument()
    expect(screen.queryByText(/done your part/i)).not.toBeInTheDocument()
  })
})

describe('GridStrip', () => {
  it('names levels in text, not only colour, and credits the source', () => {
    wrap(<GridStrip grid={grid} />)
    expect(screen.getByText(/65 % renewable, High/)).toBeInTheDocument()
    expect(screen.getByText(/20 % renewable, Low/)).toBeInTheDocument()
    expect(screen.getByText('Data: Energy-Charts, Fraunhofer ISE')).toBeInTheDocument()
  })

  it('falls back gracefully without data', () => {
    wrap(<GridStrip grid={{ ...grid, source: 'FALLBACK', points: [], bestWindow: null }} />)
    expect(screen.getByText(/Live grid data is not available/)).toBeInTheDocument()
  })
})
