import { nextRunText, recurrenceText } from './format'

describe('recurrenceText', () => {
  it('describes each schedule from its start date', () => {
    expect(recurrenceText({ recurrence: 'NONE', startsOn: '2026-10-05' })).toBeNull()
    expect(recurrenceText({ recurrence: 'DAILY', startsOn: '2026-10-05' })).toBe('Every day')
    expect(recurrenceText({ recurrence: 'WEEKDAYS', startsOn: '2026-10-05' })).toBe('Every weekday')
    expect(recurrenceText({ recurrence: 'WEEKLY', startsOn: '2026-10-05' })).toBe('Every Monday')
    expect(recurrenceText({ recurrence: 'MONTHLY', startsOn: '2026-10-01' })).toBe('Every month on the 1st')
    expect(recurrenceText({ recurrence: 'MONTHLY', startsOn: '2026-10-12' })).toBe('Every month on the 12th')
    expect(recurrenceText({ recurrence: 'MONTHLY', startsOn: '2026-10-23' })).toBe('Every month on the 23rd')
  })

  it('has no next run for one-tap templates', () => {
    expect(nextRunText({ nextRunOn: null })).toBeNull()
  })
})
