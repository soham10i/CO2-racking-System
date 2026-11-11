import type { Factor } from '../../api/types'

/**
 * Local parser for the quick-log bar: "train 40 km", "2 beef meals", "electricity 120 kwh", "drove 12km with 2".
 * It only picks a factor and an amount. The emission itself always comes from the server's estimate.
 */

export interface QuickLogMatch {
  factor: Factor
  quantity: number | null
  passengers: number | null
  score: number
}

/** Everyday words people type, keyed by factor subtype. Labels and subtypes are matched as well. */
const SYNONYMS: Record<string, string[]> = {
  CAR_PETROL: ['car', 'drive', 'drove', 'driving', 'petrol', 'gasoline', 'benzin'],
  CAR_DIESEL: ['diesel'],
  CAR_HYBRID: ['hybrid'],
  CAR_EV: ['ev', 'electric car', 'tesla', 'e-auto'],
  MOTORBIKE: ['motorbike', 'motorcycle', 'scooter', 'moped'],
  BUS: ['bus', 'coach'],
  TRAIN_REGIONAL: ['train', 'regional', 'rb', 're', 's-bahn', 'sbahn'],
  TRAIN_LONG: ['ice', 'intercity', 'long-distance', 'long distance train'],
  TRAM_SUBWAY: ['tram', 'subway', 'metro', 'u-bahn', 'ubahn', 'underground', 'tube'],
  FLIGHT_SHORT: ['flight', 'flew', 'fly', 'plane', 'short-haul', 'short haul'],
  FLIGHT_LONG: ['long-haul', 'long haul', 'long flight', 'transatlantic'],
  BIKE_WALK: ['bike', 'bicycle', 'cycled', 'cycling', 'walk', 'walked', 'walking', 'run', 'ran'],
  ELECTRICITY: ['electricity', 'power', 'strom', 'electric bill'],
  NATURAL_GAS: ['gas', 'natural gas', 'heating gas'],
  HEATING_OIL: ['oil', 'heating oil', 'heizöl'],
  DISTRICT_HEATING: ['district heating', 'fernwärme', 'heat network'],
  MEAL_BEEF: ['beef', 'burger', 'steak'],
  MEAL_LAMB: ['lamb', 'mutton'],
  MEAL_PORK: ['pork', 'ham', 'bacon', 'sausage'],
  MEAL_POULTRY: ['chicken', 'poultry', 'turkey'],
  MEAL_FISH: ['fish', 'salmon', 'sushi'],
  MEAL_VEGETARIAN: ['vegetarian', 'veggie', 'cheese'],
  MEAL_VEGAN: ['vegan', 'plant-based', 'plant based'],
  JEANS: ['jeans', 'denim'],
  TSHIRT: ['t-shirt', 'tshirt', 'tee', 'shirt'],
  SMARTPHONE: ['phone', 'smartphone', 'iphone'],
  LAPTOP: ['laptop', 'notebook', 'macbook'],
  OTHER_GOODS: ['spent', 'shopping', 'goods', 'bought', '€', 'eur', 'euro', 'euros'],
  RECYCLING: ['recycling', 'recycled', 'recycle'],
  COMPOST: ['compost', 'composted', 'organic', 'bio'],
  LANDFILL: ['landfill'],
  INCINERATION: ['bin', 'trash', 'rubbish', 'waste', 'garbage', 'residual'],
}

/** Words that name a unit; they count towards the amount, not the activity. */
const UNIT_WORDS: Record<string, string> = {
  km: 'KM', kms: 'KM', kilometer: 'KM', kilometers: 'KM', kilometre: 'KM', kilometres: 'KM',
  kwh: 'KWH', l: 'LITRE', litre: 'LITRE', litres: 'LITRE', liter: 'LITRE', liters: 'LITRE',
  meal: 'MEAL', meals: 'MEAL', item: 'ITEM', items: 'ITEM', x: 'ITEM', pcs: 'ITEM',
  kg: 'KG', kilo: 'KG', kilos: 'KG', eur: 'EUR', euro: 'EUR', euros: 'EUR', '€': 'EUR',
}

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'for', 'and', 'with', 'by', 'in', 'on', 'my', 'today', 'meal', 'meals'])

function normalise(s: string): string {
  return s.toLowerCase().replace(/[()/,]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** First number in the text, accepting a decimal comma ("1,5 kwh"). */
function readNumber(text: string): { value: number; rest: string } | null {
  const m = /(\d+(?:[.,]\d+)?)/.exec(text)
  if (!m) return null
  return { value: Number(m[1]!.replace(',', '.')), rest: text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length) }
}

/** "with 2", "2 people", "3 passengers" set the passenger count on shareable modes. */
function readPassengers(text: string): { value: number; rest: string } | null {
  const m = /\b(?:with\s+(\d+)(?:\s+(?:people|persons|others|friends))?|(\d+)\s+(?:people|persons|passengers|pax))\b/.exec(text)
  if (!m) return null
  return { value: Number(m[1] ?? m[2]), rest: text.replace(m[0], ' ') }
}

function scoreFactor(f: Factor, words: string[], text: string, unit: string | null): number {
  let score = 0
  const label = normalise(f.label)
  const subtype = f.subtype.toLowerCase().replace(/_/g, ' ')
  for (const phrase of SYNONYMS[f.subtype] ?? []) {
    // Multi-word phrases are worth more, so "long haul" beats the plain "flight" synonym.
    if (phrase.includes(' ') ? text.includes(phrase) : words.includes(phrase)) score += 3 + phrase.split(' ').length
  }
  for (const w of words) {
    if (w.length < 2 || STOP.has(w)) continue
    if (label.split(' ').includes(w)) score += 2
    else if (label.includes(w) || subtype.includes(w)) score += 1
  }
  if (score > 0 && unit && unit === f.unit) score += 1
  return score
}

export function parseQuickLog(input: string, factors: Factor[]): QuickLogMatch[] {
  // Numbers are read before normalising, which would turn a decimal comma into a space.
  let text = input.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!text) return []

  const pax = readPassengers(text)
  if (pax) text = pax.rest
  const num = readNumber(text)
  if (num) text = num.rest

  // "12km" glues the unit to the number; split it before reading words.
  const words = normalise(text.replace(/(\d)([a-z€])/g, '$1 $2')).split(' ').filter(Boolean)
  const unitWord = words.find((w) => UNIT_WORDS[w])
  const unit = unitWord ? UNIT_WORDS[unitWord]! : null
  const activityWords = words.filter((w) => !UNIT_WORDS[w] || SYNONYMS.OTHER_GOODS!.includes(w))
  const phraseText = ` ${activityWords.join(' ')} `

  const bySubtype = new Map<string, Factor>()
  for (const f of factors) if (!bySubtype.has(f.subtype)) bySubtype.set(f.subtype, f)

  return [...bySubtype.values()]
    .map((factor) => ({
      factor,
      quantity: num?.value ?? null,
      passengers: factor.shareable && pax ? pax.value : null,
      score: scoreFactor(factor, activityWords, phraseText, unit),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.factor.label.localeCompare(b.factor.label))
    .slice(0, 5)
}

/** A bare "beef meal" means one meal; distances and energy need a number. */
export function defaultQuantity(m: QuickLogMatch): number | null {
  if (m.quantity !== null) return m.quantity
  return m.factor.unit === 'MEAL' || m.factor.unit === 'ITEM' ? 1 : null
}
