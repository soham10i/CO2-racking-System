import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useRef } from 'react'

// Renders a LaTeX expression with KaTeX. katex.render writes into the element through the DOM
// API, which the CSP allows; renderToString + innerHTML would emit style attributes it blocks.
export function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) katex.render(tex, ref.current, { displayMode: display, throwOnError: false })
  }, [tex, display])

  if (display) {
    return <div ref={ref as React.RefObject<HTMLDivElement>} tabIndex={0} className="overflow-x-auto overflow-y-hidden rounded-2xl border border-line bg-raised px-4 py-2 text-ink" />
  }
  return <span ref={ref} />
}
