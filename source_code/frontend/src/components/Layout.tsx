import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PageTransition } from './PageTransition'
import { OfflineSync } from '../features/offline/OfflineSync'
import { useAuth } from '../features/auth/AuthContext'
import { QuickLogProvider, useQuickLog } from '../features/quicklog/CommandBar'
import { ThemeToggle } from './ThemeToggle'
import { NotificationBell } from '../features/notifications/NotificationBell'
import { useGoal } from '../features/planning/hooks'
import { useEffect, useState } from 'react'
import { AppIcon, Button } from './ui'
import { useT, type MessageKey } from '../lib/i18n'

// SF Symbols-style outline glyphs (24px grid, 1.8 stroke) so the sidebar reads like a macOS source list.
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

const nav = [
  { to: '/', label: 'nav.dashboard' as MessageKey, end: true, icon: icon('M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-13h6V4h-6v3Z') },
  { to: '/insights', label: 'nav.insights' as MessageKey, end: false, icon: icon('M4 19V5m0 14h16M8 15l3.5-4 3 2.5L20 7') },
  { to: '/plan', label: 'nav.plan' as MessageKey, end: false, icon: icon('M8 3v3m8-3v3M4.5 8.5h15M5 5.5h14v14H5v-14Zm4 8.5 2 2 4-4') },
  { to: '/calculator', label: 'nav.calculator' as MessageKey, end: false, icon: icon('M6 3h12v18H6V3Zm2.5 3h7v3h-7V6Zm.5 6.5h.01M12 12.5h.01M15 12.5h.01M9 15.5h.01M12 15.5h.01M15 15.5h.01M9 18.5h.01M12 18.5h.01M15 18.5h.01') },
  { to: '/nexus', label: 'nav.nexus' as MessageKey, end: false, icon: icon('M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Zm6 11 .9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z') },
  { to: '/log', label: 'nav.log' as MessageKey, end: false, icon: icon('M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01') },
  { to: '/templates', label: 'nav.templates' as MessageKey, end: false, icon: icon('M6 4h12v16l-6-4-6 4V4Z') },
  { to: '/household', label: 'nav.household' as MessageKey, end: false, icon: icon('M4 11 12 4l8 7v9h-5v-6h-6v6H4v-9Z') },
  { to: '/methodology', label: 'nav.methodology' as MessageKey, end: false, icon: icon('M5 4h10l4 4v12H5V4Zm10 0v4h4M8 12h8M8 16h5') },
  { to: '/settings', label: 'nav.settings' as MessageKey, end: false, icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z') },
]

const adminNav = { to: '/admin/factors', label: 'nav.admin' as MessageKey, end: false, icon: icon('M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4') }

type NavItem = (typeof nav)[number]
type NavGroup = { id: string; label: MessageKey; items: NavItem[] }

const byPath = (...paths: string[]) => paths.map((p) => nav.find((n) => n.to === p)!)

const groups: NavGroup[] = [
  { id: 'overview', label: 'nav.group.overview' as MessageKey, items: byPath('/', '/plan', '/nexus', '/insights') },
  { id: 'tracking', label: 'nav.group.tracking' as MessageKey, items: byPath('/log', '/calculator', '/templates', '/household') },
  { id: 'more', label: 'nav.group.more' as MessageKey, items: byPath('/methodology', '/settings') },
]

export function Layout() {
  return (
    <QuickLogProvider>
      <Shell />
    </QuickLogProvider>
  )
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

function QuickLogButton({ compact = false }: { compact?: boolean }) {
  const open = useQuickLog()
  const { t } = useT()
  if (compact)
    return (
      <button type="button" onClick={open} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-ink transition active:scale-95" aria-label={t('shell.quickLog')}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    )
  return (
    <button
      type="button"
      onClick={open}
      className="group mb-5 flex min-h-[48px] w-full items-center gap-3 rounded-full bg-primary pl-1.5 pr-3 text-sm font-semibold text-primary-ink transition hover:opacity-90 active:scale-[0.98]"
    >
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand text-brand-ink">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span className="flex-1 text-left">{t('shell.quickLog')}</span>
      <kbd className="rounded-md border border-current px-1.5 py-0.5 font-sans text-[11px] font-medium opacity-80">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
    </button>
  )
}

function Shell() {
  const { state, logout } = useAuth()
  const { t } = useT()
  const name = state.status === 'authed' ? state.user.profile.displayName : ''
  const isAdmin = state.status === 'authed' && state.user.role === 'ADMIN'
  const link = ({ isActive }: { isActive: boolean }) =>
    `group flex min-h-[44px] items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-primary text-primary-ink' : 'text-muted hover:bg-fill hover:text-ink'
    }`

  return (
    <div className="min-h-screen bg-bg md:grid md:grid-cols-[272px_minmax(0,1fr)] md:gap-5 md:p-4">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-ink">
        {t('shell.skip')}
      </a>
      <aside className="glass-strong sticky top-0 z-10 border-b border-line px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:top-4 md:flex md:h-[calc(100vh-2rem)] md:flex-col md:rounded-card md:border md:p-4">
        <div className="flex items-center gap-3 md:mb-6 md:px-1 md:pt-1">
          <AppIcon size={34} />
          <p className="font-display text-lg font-semibold leading-none tracking-tight">
            CO2 Tracker
            <span aria-hidden className="ml-1.5 inline-block h-2 w-2 rounded-full bg-brand align-middle ring-1 ring-line" />
          </p>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="md:hidden">
              <ThemeToggle compact />
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <QuickLogButton />
        </div>
        {/* Phone: one scrolling row (the main four live in the tab bar). Desktop: collapsible groups. */}
        <nav aria-label={t('nav.main')} className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
          {(isAdmin ? [...nav, adminNav] : nav)
            .filter((n) => !tabbed.has(n.to))
            .map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={link}>
                {n.icon}
                <span className="whitespace-nowrap">{t(n.label)}</span>
              </NavLink>
            ))}
        </nav>
        <nav aria-label={t('nav.main')} className="-mx-1 hidden min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 md:flex">
          {(isAdmin ? [...groups.slice(0, 2), { ...groups[2]!, items: [...groups[2]!.items, adminNav] }] : groups).map((g) => (
            <NavSection key={g.id} group={g} link={link} />
          ))}
        </nav>
        <div className="mt-4 hidden space-y-3 border-t border-line pt-4 md:block">
          <ThemeToggle className="flex w-full" />
          <div className="flex items-center gap-3 rounded-2xl bg-fill p-2.5">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand font-display text-base font-semibold text-brand-ink">
              {name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => void logout()}>
            {t('shell.signOut')}
          </Button>
        </div>
      </aside>
      <main id="main" className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-5 md:px-8 md:pb-12 md:pt-8">
        <OfflineSync />
        <PageTransition />
        <div className="mt-10 border-t border-line pt-6 md:hidden">
          <Button variant="secondary" className="w-full" onClick={() => void logout()}>
            {t('shell.signOut')}
          </Button>
        </div>
      </main>
      <TabBar />
      <BudgetWallpaper />
    </div>
  )
}

/** A sidebar group that folds open and shut; it opens itself when you land on one of its pages. */
function NavSection({ group, link }: { group: NavGroup; link: (s: { isActive: boolean }) => string }) {
  const { t } = useT()
  const { pathname } = useLocation()
  const storageKey = `nav-open:${group.id}`
  const holdsActive = group.items.some((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== 'false'
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (holdsActive) setOpen(true)
  }, [holdsActive])
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(storageKey, String(!o))
      } catch {
        /* private mode: remember for this visit only */
      }
      return !o
    })
  const panelId = `nav-group-${group.id}`
  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[32px] w-full items-center gap-2 rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted transition hover:text-ink"
      >
        <span className="flex-1 text-left">{t(group.label)}</span>
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 pb-1 pt-1">
              {group.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={link}>
                  {n.icon}
                  <span className="truncate">{t(n.label)}</span>
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The phone's main destinations sit in a bottom bar within thumb reach; the rest stay in the header. */
const tabbed = new Set(['/', '/insights', '/log', '/settings'])

function TabBar() {
  const openQuickLog = useQuickLog()
  const { t } = useT()
  const items = nav.filter((n) => tabbed.has(n.to))
  const tab = ({ isActive }: { isActive: boolean }) =>
    `group flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${isActive ? 'text-ink' : 'text-muted'}`
  const short: Record<string, MessageKey> = { '/': 'tab.home', '/insights': 'tab.insights', '/log': 'tab.log', '/settings': 'tab.settings' }
  const link = (n: (typeof nav)[number]) => (
    <NavLink key={n.to} to={n.to} end={n.end} className={tab}>
      {({ isActive }) => (
        <>
          <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${isActive ? 'bg-primary text-primary-ink' : 'group-hover:bg-fill'}`}>{n.icon}</span>
          <span className={isActive ? 'font-semibold' : ''}>{t(short[n.to]!)}</span>
        </>
      )}
    </NavLink>
  )
  return (
    <nav aria-label={t('nav.tabs')} className="glass-strong fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 flex items-stretch rounded-full border border-line px-1.5 md:hidden">
      {items.slice(0, 2).map(link)}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={openQuickLog}
          className="-mt-6 grid h-16 w-16 place-items-center rounded-full bg-brand text-brand-ink ring-[6px] ring-bg transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="sr-only">{t('shell.quickLog')}</span>
        </button>
      </div>
      {items.slice(2).map(link)}
    </nav>
  )
}

/** Tints the page background by this month's budget status (see body::before in index.css). */
function BudgetWallpaper() {
  const status = useGoal().data?.status
  useEffect(() => {
    const root = document.documentElement
    if (status) root.dataset.budget = status
    return () => {
      delete root.dataset.budget
    }
  }, [status])
  return null
}
