import { useTheme, type ThemePreference } from '../lib/theme'
import { useT, type MessageKey } from '../lib/i18n'

const options: { value: ThemePreference; label: MessageKey; d: string }[] = [
  { value: 'light', label: 'theme.light', d: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
  { value: 'dark', label: 'theme.dark', d: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z' },
  { value: 'system', label: 'theme.system', d: 'M4 5h16v11H4V5Zm5 15h6m-3-4v4' },
]

/** Light / Dark / Auto (follow the device), as a segmented control. `compact` shows icons only. */
export function ThemeToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const [pref, setPref] = useTheme()
  const { t } = useT()
  return (
    <div className={`segmented ${className}`} role="group" aria-label={t('theme.group')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={"segment flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-xs font-medium"}
          aria-pressed={pref === o.value}
          title={o.value === 'system' ? t('theme.systemTitle') : t('theme.title', { label: t(o.label) })}
          onClick={() => setPref(o.value)}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={o.d} />
          </svg>
          <span className={compact ? 'sr-only' : ''}>{t(o.label)}</span>
        </button>
      ))}
    </div>
  )
}
