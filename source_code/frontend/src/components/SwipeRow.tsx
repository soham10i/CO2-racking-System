import { useRef, useState, type ReactNode, type PointerEvent } from 'react'

const THRESHOLD = 88

interface SwipeAction {
  label: string
  run: () => void
  tone: 'primary' | 'danger'
}

/**
 * Touch-only swipe on a list row: right runs `right` (e.g. log again), left runs `left` (e.g. delete).
 * It is a shortcut only; the row's own buttons do the same things for mouse, keyboard and screen readers.
 */
export function SwipeRow({ children, left, right }: { children: ReactNode; left?: SwipeAction; right?: SwipeAction }) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const locked = useRef<'x' | 'y' | null>(null)
  const [dx, setDx] = useState(0)

  function down(e: PointerEvent) {
    if (e.pointerType !== 'touch') return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    locked.current = null
  }
  function move(e: PointerEvent) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const x = e.clientX - s.x
    const y = e.clientY - s.y
    if (!locked.current && Math.abs(x) + Math.abs(y) > 8) locked.current = Math.abs(x) > Math.abs(y) ? 'x' : 'y'
    if (locked.current !== 'x') return
    if ((x > 0 && !right) || (x < 0 && !left)) return setDx(0)
    setDx(Math.max(-140, Math.min(140, x)))
  }
  function up() {
    if (!start.current) return
    start.current = null
    if (dx >= THRESHOLD) right?.run()
    else if (dx <= -THRESHOLD) left?.run()
    setDx(0)
  }

  const action = dx > 0 ? right : dx < 0 ? left : undefined
  const armed = Math.abs(dx) >= THRESHOLD
  return (
    <div className="relative overflow-hidden">
      {action && (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center px-4 text-sm font-semibold ${
            action.tone === 'danger' ? 'bg-danger text-danger-ink' : 'bg-brand text-brand-ink'
          } ${dx > 0 ? 'justify-start' : 'justify-end'} ${armed ? '' : 'opacity-60'} transition-opacity`}
        >
          {action.label}
        </div>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        className={`relative bg-surface ${dx === 0 ? 'transition-transform duration-200' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}
