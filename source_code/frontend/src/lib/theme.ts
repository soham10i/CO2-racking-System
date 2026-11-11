import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

// Same key as public/theme-init.js, which applies the choice before the app loads (no flash of the wrong theme).
const KEY = 'co2.theme'
const EVENT = 'co2:themechange'

export function readTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** System removes the attribute so the CSS media query decides; light/dark pin the tokens. */
export function applyTheme(pref: ThemePreference) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  window.dispatchEvent(new Event(EVENT))
}

export function setTheme(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this page only.
  }
  applyTheme(pref)
}

/** Runs `callback` whenever the effective colour scheme may have changed: a user choice or an OS switch. */
export function onSchemeChange(callback: () => void): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  mq?.addEventListener('change', callback)
  window.addEventListener(EVENT, callback)
  return () => {
    mq?.removeEventListener('change', callback)
    window.removeEventListener(EVENT, callback)
  }
}

export function useTheme(): [ThemePreference, (pref: ThemePreference) => void] {
  const [pref, setPref] = useState(readTheme)
  useEffect(() => onSchemeChange(() => setPref(readTheme())), [])
  return [pref, setTheme]
}
