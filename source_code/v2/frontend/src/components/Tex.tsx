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
    return <div ref={ref as React.RefObject<HTMLDivElement>} className="overflow-x-auto overflow-y-hidden rounded-xl bg-fill px-3 py-1" />
  }
  return <span ref={ref} />
}
