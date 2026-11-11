import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActivityForm from './ActivityForm'
import { AuthProvider } from '../auth/AuthContext'
import { ToastProvider } from '../../components/Toast'

const factors = [
  { id: 'f1', category: 'TRANSPORT', subtype: 'CAR_PETROL', label: 'Car (petrol)', unit: 'KM', kgCo2ePerUnit: 0.17, sourceName: 'Test', shareable: true, maxQuantity: 2000 },
  { id: 'f2', category: 'TRANSPORT', subtype: 'BUS', label: 'Bus', unit: 'KM', kgCo2ePerUnit: 0.1, sourceName: 'Test', shareable: false, maxQuantity: 2000 },
  { id: 'f3', category: 'ENERGY', subtype: 'NATURAL_GAS', label: 'Natural gas', unit: 'KWH', kgCo2ePerUnit: 0.2, sourceName: 'Test', shareable: false, maxQuantity: 100000 },
]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function mockApi() {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/emission-factors')) return json(factors)
    if (url.endsWith('/calculator/estimate')) {
      return json({ kgCo2e: 2.04, unit: 'KM', label: 'Car (petrol)', factor: { id: 'f1', kgCo2ePerUnit: 0.17, unit: 'KM', sourceName: 'Test', version: 1 } })
    }
    if (url.endsWith('/activities') && init?.method === 'POST') return json({ id: 'a1' }, 201)
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/log/new']}>
            <Routes>
              <Route path="/log/new" element={<ActivityForm />} />
              <Route path="/log" element={<p>log page</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('ActivityForm', () => {
  it('blocks submit with an accessible error when the amount is missing', async () => {
    const fetchMock = mockApi()
    renderForm()
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter an amount greater than 0')).toBeInTheDocument()
    expect(screen.getByLabelText(/Amount/)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/activities') && init?.method === 'POST')).toBe(false)
  })

  it('shows a server-computed preview and submits only inputs, never a result', async () => {
    const fetchMock = mockApi()
    renderForm()
    await userEvent.type(await screen.findByLabelText(/Amount/), '12')
    expect(await screen.findByText(/≈ 2\.0 kg CO2e/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('log page')

    const post = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/activities') && init?.method === 'POST')
    const body = JSON.parse(String(post?.[1]?.body))
    expect(body).toMatchObject({ category: 'TRANSPORT', subtype: 'CAR_PETROL', quantity: 12, passengers: 1 })
    expect(body).not.toHaveProperty('kgCo2e')
  })

  it('only offers passengers for shareable trips and switches category options', async () => {
    mockApi()
    renderForm()
    expect(await screen.findByLabelText(/Passengers/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'BUS')
    await waitFor(() => expect(screen.queryByLabelText(/Passengers/)).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Home energy' }))
    expect(screen.getByLabelText(/Amount \(kWh\)/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Natural gas' })).toBeInTheDocument()
  })
})
