import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { de } from './locales/de'
import { en, type Messages } from './locales/en'

export type Locale = 'en' | 'de'
export const locales: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
]

const dictionaries: Record<Locale, Messages> = { en, de }
const storageKey = 'co2.locale'

// Formatting helpers outside React (lib/format.ts) read the active locale from here.
let active: Locale = initialLocale()

export const currentLocale = () => active

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'en' || saved === 'de') return saved
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export type MessageKey = keyof Messages

/** Looks up a message and fills `{name}` placeholders; a missing German string falls back to English. */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const text: string = dictionaries[locale][key] ?? en[key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

interface I18nValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(active)

  const setLocale = useCallback((l: Locale) => {
    active = l
    try {
      localStorage.setItem(storageKey, l)
    } catch {
      // The choice still applies for this visit.
    }
    setLocaleState(l)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  )
  // Remounting on a switch re-renders numbers and dates formatted outside React with the new locale.
  return (
    <I18nContext.Provider value={value}>
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  )
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  if (ctx) return ctx
  // Outside the provider (isolated component tests): English, no switching.
  return { locale: 'en', setLocale: () => undefined, t: (key, vars) => translate('en', key, vars) }
}
