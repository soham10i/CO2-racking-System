import { describe, expect, it } from 'vitest'
import { levelOf, thresholds, weeks } from './heatmap'

describe('calendar heatmap', () => {
  it('bins days by the quartiles of logged days, keeping empty days at level 0', () => {
    const t = thresholds([0, 1, 2, 3, 4, 0])
    expect(t).toEqual([2, 3, 4])
    expect(levelOf(0, t)).toBe(0)
    expect(levelOf(1, t)).toBe(1)
    expect(levelOf(4, t)).toBe(3)
    expect(levelOf(9, t)).toBe(4)
  })

  it('lays out Monday-first weeks and pads days outside the range', () => {
    // 2026-10-28 is a Wednesday.
    const r = weeks([{ start: '2026-10-29', end: '2026-10-29', total: 5, byCategory: {} as never }], '2026-10-28', '2026-11-02')
    expect(r.weeks).toHaveLength(2)
    expect(r.weeks[0]!.slice(0, 2)).toEqual([null, null])
    expect(r.weeks[0]![3]).toMatchObject({ date: '2026-10-29', kg: 5, level: 1 })
    expect(r.weeks[1]![0]).toMatchObject({ date: '2026-11-02', level: 0 })
    expect(r.weeks[1]![1]).toBeNull()
  })
})
