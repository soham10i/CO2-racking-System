import { useCountUp } from '../lib/motion'

/** Animated number for sighted users; assistive tech reads the final value once. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const shown = useCountUp(value)
  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}
