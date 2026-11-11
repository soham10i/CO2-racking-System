import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import Login from './Login'

vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))

describe('Login', () => {
  it('shows accessible validation errors and does not call the API when empty', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    )
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Enter your email')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls)
  })
})
