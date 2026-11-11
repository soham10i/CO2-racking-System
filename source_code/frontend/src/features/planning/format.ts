import type { Recurrence, Template } from '../../api/types'
import { shortDate } from '../../lib/format'

export const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: 'NONE', label: 'Don’t repeat' },
  { value: 'DAILY', label: 'Every day' },
  { value: 'WEEKDAYS', label: 'Every weekday' },
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'MONTHLY', label: 'Every month' },
]

const weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' })

/** "Every Monday", "Every month on the 5th", … from the series' start date. */
export function recurrenceText(t: Pick<Template, 'recurrence' | 'startsOn'>): string | null {
  if (t.recurrence === 'NONE' || !t.startsOn) return null
  const start = new Date(`${t.startsOn}T00:00:00Z`)
  switch (t.recurrence) {
    case 'DAILY':
      return 'Every day'
    case 'WEEKDAYS':
      return 'Every weekday'
    case 'WEEKLY':
      return `Every ${weekday.format(start)}`
    case 'MONTHLY':
      return `Every month on the ${ordinal(start.getUTCDate())}`
  }
}

export function nextRunText(t: Pick<Template, 'nextRunOn'>): string | null {
  return t.nextRunOn ? `next ${shortDate(t.nextRunOn)}` : null
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${s}`
}
