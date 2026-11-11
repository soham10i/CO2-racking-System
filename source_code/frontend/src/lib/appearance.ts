import { useState } from 'react'

/** Interface tint for links and secondary buttons. Status colours (on track / at risk / over) never change. */
export type Accent = 'blue' | 'indigo' | 'teal' | 'pink'

export const accents: { value: Accent; label: string; swatch: string }[] = [
  { value: 'blue', label: 'Blue', swatch: '#0066cc' },
  { value: 'indigo', label: 'Indigo', swatch: '#4b44c8' },
  { value: 'teal', label: 'Teal', swatch: '#00787a' },
  { value: 'pink', label: 'Pink', swatch: '#c4006a' },
]

// Same keys as public/theme-init.js, which applies them before first paint.
const ACCENT = 'co2.accent'
const SOLID = 'co2.solid'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* blocked storage: the choice lasts for this page only */
  }
}

export function readAccent(): Accent {
  const v = read(ACCENT)
  return accents.some((a) => a.value === v) ? (v as Accent) : 'blue'
}

export function useAccent(): [Accent, (a: Accent) => void] {
  const [accent, setAccent] = useState(readAccent)
  return [
    accent,
    (a) => {
      store(ACCENT, a === 'blue' ? null : a)
      if (a === 'blue') delete document.documentElement.dataset.accent
      else document.documentElement.dataset.accent = a
      setAccent(a)
    },
  ]
}

/** In-app "Reduce transparency": solid surfaces and no wallpaper, on top of the OS setting. */
export function useSolidSurfaces(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => read(SOLID) === '1')
  return [
    on,
    (v) => {
      store(SOLID, v ? '1' : null)
      if (v) document.documentElement.dataset.transparency = 'reduced'
      else delete document.documentElement.dataset.transparency
      setOn(v)
    },
  ]
}
