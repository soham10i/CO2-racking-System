import { motion, useReducedMotion } from 'framer-motion'
import { useLayoutEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { lenis } from '../lib/smoothScroll'

/**
 * Route outlet that fades and lifts each page in. Entrance only: waiting for an exit would hold the old
 * page on screen during quick redirects (onboarding → baseline → dashboard).
 */
export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <motion.div
      key={location.pathname}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.36, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {outlet}
    </motion.div>
  )
}
