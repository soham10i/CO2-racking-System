import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { AppIcon, Button } from './ui'

// SF Symbols-style outline glyphs (24px grid, 1.8 stroke) so the sidebar reads like a macOS source list.
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const nav = [
  { to: '/', label: 'Dashboard', end: true, icon: icon('M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-13h6V4h-6v3Z') },
  { to: '/insights', label: 'Insights', end: false, icon: icon('M4 19V5m0 14h16M8 15l3.5-4 3 2.5L20 7') },
  { to: '/log', label: 'Activity log', end: false, icon: icon('M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01') },
  { to: '/templates', label: 'Templates', end: false, icon: icon('M6 4h12v16l-6-4-6 4V4Z') },
  { to: '/methodology', label: 'Methodology', end: false, icon: icon('M5 4h10l4 4v12H5V4Zm10 0v4h4M8 12h8M8 16h5') },
  { to: '/settings', label: 'Settings', end: false, icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z') },
]

export function Layout() {
  const { state, logout } = useAuth()
  const name = state.status === 'authed' ? state.user.profile.displayName : ''
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[36px] items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-primary text-primary-ink shadow-sm' : 'text-ink hover:bg-fill'
    }`

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr] md:gap-4 md:p-3">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-surface focus:p-2">
        Skip to content
      </a>
      <aside className="glass sticky top-0 z-10 rounded-b-card p-3 md:top-3 md:flex md:h-[calc(100vh-1.5rem)] md:flex-col md:rounded-card">
        <div className="mb-3 flex items-center gap-2.5 px-2 pt-1">
          <AppIcon size={30} />
          <p className="text-base font-semibold tracking-tight">CO2 Tracker</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              {n.icon}
              <span className="whitespace-nowrap">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-line px-1 pt-3 md:block">
          <p className="truncate px-2 text-sm text-muted">{name}</p>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </aside>
      <main id="main" className="mx-auto w-full max-w-5xl p-4 md:px-6 md:py-8">
        <Outlet />
        <div className="mt-8 md:hidden">
          <Button variant="secondary" className="w-full" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </main>
    </div>
  )
}
