import { describe, expect, it } from 'vitest'
import { defaultQuantity, parseQuickLog } from './parse'
import type { Category, Factor } from '../../api/types'

const f = (category: Category, subtype: string, label: string, unit: string, shareable = false): Factor => ({
  id: subtype,
  category,
  subtype,
  label,
  unit,
  kgCo2ePerUnit: 0.1,
  sourceName: 'test',
  shareable,
  maxQuantity: 10000,
  validFrom: '2026-01-01',
  version: 1,
})

const factors = [
  f('TRANSPORT', 'CAR_PETROL', 'Car (petrol)', 'KM', true),
  f('TRANSPORT', 'CAR_EV', 'Car (electric)', 'KM', true),
  f('TRANSPORT', 'TRAIN_REGIONAL', 'Regional train', 'KM'),
  f('TRANSPORT', 'TRAIN_LONG', 'Long-distance train', 'KM'),
  f('TRANSPORT', 'FLIGHT_SHORT', 'Flight (short-haul)', 'KM'),
  f('TRANSPORT', 'FLIGHT_LONG', 'Flight (long-haul)', 'KM'),
  f('ENERGY', 'ELECTRICITY', 'Electricity (Germany)', 'KWH'),
  f('ENERGY', 'ELECTRICITY', 'Electricity (global avg)', 'KWH'),
  f('DIET', 'MEAL_BEEF', 'Meal with beef', 'MEAL'),
  f('DIET', 'MEAL_VEGAN', 'Vegan meal', 'MEAL'),
  f('SHOPPING', 'OTHER_GOODS', 'Other goods (per EUR spent)', 'EUR'),
  f('WASTE', 'RECYCLING', 'Recycling', 'KG'),
]

const top = (text: string) => parseQuickLog(text, factors)[0]

describe('parseQuickLog', () => {
  it('reads an activity and a distance', () => {
    const m = top('train 40 km')!
    expect(m.factor.subtype).toBe('TRAIN_REGIONAL')
    expect(m.quantity).toBe(40)
  })

  it('accepts a unit glued to the number and a passenger count', () => {
    const m = top('drove 12km with 2')!
    expect(m.factor.subtype).toBe('CAR_PETROL')
    expect(m.quantity).toBe(12)
    expect(m.passengers).toBe(2)
  })

  it('prefers the more specific phrase', () => {
    expect(top('long haul flight 6000 km')!.factor.subtype).toBe('FLIGHT_LONG')
    expect(top('electric car 30 km')!.factor.subtype).toBe('CAR_EV')
  })

  it('reads a decimal comma and lists each subtype once', () => {
    const all = parseQuickLog('electricity 1,5 kwh', factors)
    expect(all[0]!.quantity).toBe(1.5)
    expect(all.filter((m) => m.factor.subtype === 'ELECTRICITY')).toHaveLength(1)
  })

  it('defaults countable things to one', () => {
    const m = top('beef meal')!
    expect(m.factor.subtype).toBe('MEAL_BEEF')
    expect(defaultQuantity(m)).toBe(1)
    expect(defaultQuantity(top('train')!)).toBeNull()
  })

  it('maps spending and ignores passengers on unshared modes', () => {
    expect(top('spent 30€')!.factor.subtype).toBe('OTHER_GOODS')
    expect(top('train 10 km with 3')!.passengers).toBeNull()
  })

  it('returns nothing for text it cannot place', () => {
    expect(parseQuickLog('', factors)).toEqual([])
    expect(parseQuickLog('hello there', factors)).toEqual([])
  })
})
