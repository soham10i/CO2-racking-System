import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

/** Inertial page scrolling. Skipped for reduced motion, so the browser's own scrolling stays in charge. */
export let lenis: Lenis | null = null

// Fast start, long soft landing.
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t))

/** Inner scroll areas (dialogs, tables, chart strips, story cards) keep native scrolling. */
const scrollsOnItsOwn = (node: HTMLElement) =>
  node.closest('dialog, [data-lenis-prevent], .overflow-auto, .overflow-y-auto, .overflow-x-auto, .story-track') !== null

export function startSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  lenis = new Lenis({
    autoRaf: true,
    duration: 1.15,
    easing: easeOutExpo,
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    anchors: { offset: -16 },
    prevent: scrollsOnItsOwn,
  })
}
