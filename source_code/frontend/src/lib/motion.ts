import { useEffect, useRef, useState } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Eases a displayed number from its previous value to `target` (from 0 on first render). The value itself is
 * the server's; this only animates how it appears. Reduced motion shows the final value at once.
 */
export function useCountUp(target: number, ms = 700): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0))
  const from = useRef(shown)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target)
      from.current = target
      return
    }
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1)
      const eased = 1 - (1 - t) ** 3
      const v = begin + (target - begin) * eased
      setShown(v)
      from.current = v
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return shown
}

/** True one frame after mount, so CSS transitions can run from an initial state. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const f = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(f)
  }, [])
  return mounted
}
