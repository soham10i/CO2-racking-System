import { NavLink } from 'react-router-dom'
import { useT } from '../../lib/i18n'
import { useNotifications } from './hooks'

/** Header bell; the badge shows the unread count and the label reads it out. */
export function NotificationBell({ className = '' }: { className?: string }) {
  const unread = useNotifications().data?.unread ?? 0
  const { t } = useT()
  const label = unread > 0 ? t('shell.notificationsUnread', { count: unread }) : t('shell.notifications')
  return (
    <NavLink
      to="/notifications"
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `relative grid h-10 w-10 place-items-center rounded-full border transition-colors ${isActive ? 'border-transparent bg-primary text-primary-ink' : 'border-line text-ink hover:bg-fill'} ${className}`
      }
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-brand px-1 text-center text-[11px] font-bold tabular-nums leading-[20px] text-brand-ink ring-2 ring-surface" aria-hidden>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  )
}
