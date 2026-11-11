import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useComparison, useTrend } from '../analytics/hooks'
import { useActions } from '../planning/hooks'
import { stories, yearSpan, yearStats } from './review'
import { renderShareImage } from './shareImage'
import { errorMessage } from '../../app/queryClient'
import { useToast } from '../../components/Toast'
import { Button, ButtonLink, EmptyState, ErrorBanner, Loading, Skeleton } from '../../components/ui'
import { prefersReducedMotion } from '../../lib/motion'
import { localToday } from '../../lib/format'

export default function YearInReview() {
  const today = localToday()
  const thisYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const span = yearSpan(year, today)
  const trend = useTrend({ from: span.from, to: span.to, granularity: 'MONTH' })
  const current = useComparison({ from: span.from, to: span.to })
  const previous = useComparison({ from: span.previousFrom, to: span.previousTo })
  const actions = useActions()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLOListElement>(null)

  const list = useMemo(() => {
    if (!trend.data || !current.data || !previous.data) return null
    const s = yearStats(trend.data, current.data, previous.data, yearSpan(year, today).complete)
    return stories(s, yearSpan(year, today), actions.data?.commitments.length ?? 0)
  }, [trend.data, current.data, previous.data, actions.data, year, today])

  const error = trend.error ?? current.error ?? previous.error
  const isPending = trend.isPending || current.isPending || previous.isPending

  /** Card stride includes the gap, so read it from the second card rather than the track width. */
  function stride(el: HTMLOListElement) {
    const [a, b] = [el.children[0] as HTMLElement | undefined, el.children[1] as HTMLElement | undefined]
    return a && b ? b.offsetLeft - a.offsetLeft : el.clientWidth
  }

  function go(i: number) {
    const el = track.current
    if (!el) return
    setIndex(i)
    el.scrollTo({ left: i * stride(el), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  function onScroll() {
    const el = track.current
    if (el) setIndex(Math.round(el.scrollLeft / stride(el)))
  }

  async function share() {
    if (!list) return
    setBusy(true)
    try {
      const blob = await renderShareImage(year, list)
      const file = new File([blob], `co2-year-${year}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `My ${year} in carbon` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        toast({ message: 'Image saved to your downloads' })
      }
    } catch (e) {
      // Closing the share sheet is not an error worth showing.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        toast({ message: errorMessage(e, 'Could not create the image') ?? 'Could not create the image', tone: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  const empty = current.data && current.data.current.total === 0

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Year in review</h1>
          <p className="mt-1.5 text-muted">Your year in a few cards, drawn from what you logged.</p>
        </div>
        <div className="segmented" role="group" aria-label="Year">
          {[thisYear - 1, thisYear].map((y) => (
            <button
              key={y}
              type="button"
              className="segment"
              aria-pressed={year === y}
              onClick={() => {
                setYear(y)
                setIndex(0)
                track.current?.scrollTo({ left: 0 })
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </header>

      <ErrorBanner message={error ? errorMessage(error, 'Could not load your year') : null} />
      {isPending ? (
        <Loading label="Loading your year">
          <Skeleton className="h-[340px] w-full rounded-card" />
        </Loading>
      ) : empty ? (
        <EmptyState art="log" title={`Nothing logged in ${year}`} action={<ButtonLink to="/log/new">Log an activity</ButtonLink>}>
          Your review fills in as you log. Pick the other year above to see it instead.
        </EmptyState>
      ) : (
        list && (
          <section aria-roledescription="carousel" aria-label={`${year} in review`} className="space-y-4">
            <ol
              ref={track}
              onScroll={onScroll}
              className="story-track flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-5"
            >
              {list.map((s, i) => (
                <li
                  key={s.key}
                  className="story-card w-full shrink-0 snap-start"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${list.length}`}
                >
                  <div
                    className={`relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-card p-6 md:min-h-[380px] md:p-8 ${
                      i % 2 === 0 ? 'bg-brand text-brand-ink' : 'bg-ink text-bg'
                    }`}
                  >
                    <svg aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-20" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="100" cy="100" r="96" />
                      <circle cx="100" cy="100" r="70" />
                      <circle cx="100" cy="100" r="44" />
                    </svg>
                    <div className="relative flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
                      <span>{s.eyebrow}</span>
                      <span aria-hidden className="tabular-nums opacity-70">
                        {String(i + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="relative">
                      <h2 className="font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">{s.headline}</h2>
                      <p className="mt-4 max-w-md text-base font-medium opacity-80 md:text-lg">{s.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous card">
                  ←
                </Button>
                <span className="min-w-[3.5rem] text-center font-display text-sm font-semibold tabular-nums" aria-live="polite">
                  {Math.min(index + 1, list.length)} / {list.length}
                </span>
                <Button variant="secondary" disabled={index >= list.length - 1} onClick={() => go(index + 1)} aria-label="Next card">
                  →
                </Button>
              </div>
              <Button onClick={() => void share()} disabled={busy} className="w-full sm:w-auto">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12M7 8l5-5 5 5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                </svg>
                {busy ? 'Drawing…' : 'Share image'}
              </Button>
            </div>
            <p className="text-xs text-muted">
              The image is drawn on this device and shows only totals: no name, email or entries. Numbers come from your
              log;{' '}
              <Link to="/methodology" className="font-medium text-accent underline underline-offset-2">
                how they are calculated
              </Link>
              .
            </p>
          </section>
        )
      )}
    </div>
  )
}
