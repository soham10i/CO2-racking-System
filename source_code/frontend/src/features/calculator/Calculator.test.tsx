import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Calculator from './Calculator'
import { AuthProvider } from '../auth/AuthContext'

const factors = [
  { id: 'f1', category: 'TRANSPORT', subtype: 'CAR_PETROL', label: 'Car (petrol)', unit: 'KM', kgCo2ePerUnit: 0.17, sourceName: 'Test', shareable: true, maxQuantity: 2000 },
  { id: 'f2', category: 'TRANSPORT', subtype: 'TRAIN_REGIONAL', label: 'Regional train', unit: 'KM', kgCo2ePerUnit: 0.05, sourceName: 'Test', shareable: false, maxQuantity: 2000 },
]

const comparison = {
  chosen: { subtype: 'CAR_PETROL', label: 'Car (petrol)', unit: 'KM', kgCo2e: 4.1 },
  alternatives: [
    { subtype: 'TRAIN_REGIONAL', label: 'Regional train', unit: 'KM', kgCo2e: 1.2, savingKg: 2.9 },
    { subtype: 'PLANE', label: 'Plane', unit: 'KM', kgCo2e: 6, savingKg: -1.9 },
  ],
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockApi() {
  const fn = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/emission-factors')) return json(factors)
    if (url.endsWith('/calculator/compare')) return json(comparison)
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('Calculator compare', () => {
  it('offers Compare and Yearly footprint tabs, lists every option lowest first with values in text and never logs', async () => {
    const fetchMock = mockApi()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter>
            <Calculator />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    )
    expect(screen.getAllByRole('button', { name: 'Compare' })[0]).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(await screen.findByLabelText(/Amount/), '24')
    await userEvent.type(screen.getByLabelText(/Passengers/), '2', { initialSelectionStart: 0, initialSelectionEnd: 1 })
    await userEvent.click(screen.getByLabelText(/Amount/).closest('form')!.querySelector('button[type="submit"]')!)

    const list = (await screen.findByText(/Every option for 24/)).closest('section')!.querySelector('ol')!
    const items = within(list).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Regional train'),
      expect.stringContaining('Car (petrol)'),
      expect.stringContaining('Plane'),
    ])
    expect(items[0]).toHaveTextContent('saves 2.9 kg')
    expect(items[1]).toHaveAttribute('aria-current', 'true')
    expect(items[1]).toHaveTextContent('Your choice')
    expect(items[2]).toHaveTextContent('1.9 kg more')

    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/calculator/compare'))
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ category: 'TRANSPORT', subtype: 'CAR_PETROL', quantity: 24, passengers: 2 })
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/activities'))).toBe(false)
  })
})
