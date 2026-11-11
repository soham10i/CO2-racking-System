// Mirrors the backend DTOs (see docs/03-api-specification.md). To be replaced by types
// generated from the OpenAPI document once the API surface grows.
export type Role = 'USER' | 'ADMIN'
export type Units = 'METRIC' | 'IMPERIAL'
export type HeatingType = 'NATURAL_GAS' | 'HEATING_OIL' | 'ELECTRIC' | 'DISTRICT' | 'HEAT_PUMP' | 'WOOD' | 'OTHER'
export type DietType = 'VEGAN' | 'VEGETARIAN' | 'PESCATARIAN' | 'LOW_MEAT' | 'OMNIVORE' | 'HIGH_MEAT'
export type CommuteMode = 'CAR' | 'PUBLIC_TRANSPORT' | 'BIKE' | 'WALK' | 'REMOTE'
export type CarFuel = 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC' | 'LPG'
export type ShoppingHabit = 'MINIMAL' | 'MODERATE' | 'FREQUENT'

export interface Profile {
  displayName: string
  country?: string | null
  region?: string | null
  timezone: string
  units: Units
  householdSize?: number | null
  heatingType?: HeatingType | null
  dietType?: DietType | null
  commuteMode?: CommuteMode | null
  car?: { fuel?: CarFuel | null; gPerKm?: number | null } | null
  shoppingHabit?: ShoppingHabit | null
  digestOptIn: boolean
  onboardingCompleted: boolean
  /** UI and email language; omitted on save keeps the current one. */
  locale?: 'en' | 'de'
}

export interface Me {
  id: string
  email: string
  role: Role
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
  profile: Profile
}

export interface AuthResponse {
  accessToken: string
  expiresIn: number
  user: Me
}

export interface FieldProblem {
  field: string
  message: string
}

export type Category = 'TRANSPORT' | 'ENERGY' | 'DIET' | 'SHOPPING' | 'WASTE'

export interface Factor {
  id: string
  category: Category
  subtype: string
  label: string
  unit: string
  kgCo2ePerUnit: number
  region?: string | null
  sourceName: string
  sourceUrl?: string | null
  methodNote?: string | null
  shareable: boolean
  maxQuantity: number
  validFrom: string
  version: number
}

export interface FactorRef {
  id: string
  kgCo2ePerUnit: number
  unit: string
  sourceName: string
  sourceUrl?: string | null
  version: number
}

export interface Activity {
  id: string
  category: Category
  subtype: string
  label: string
  quantity: number
  unit: string
  occurredOn: string
  passengers: number
  note?: string | null
  kgCo2e: number
  factor: FactorRef
  createdAt: string
  version: number
  /** Set on entries split across a household; only the member who logged it can change it. */
  share?: { count: number; totalQuantity: number; editable: boolean } | null
}

export interface ActivityInput {
  category: Category
  subtype: string
  quantity: number
  occurredOn: string
  passengers?: number
  note?: string
  version?: number
  shareWithHousehold?: boolean
}

export interface Estimate {
  kgCo2e: number
  unit: string
  label: string
  factor: FactorRef
}

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface Summary {
  date: string
  today: number
  week: number
  month: number
  year: number
  /** Same span of the previous month, for a fair month-to-date comparison. */
  previousMonthToDate: number
  monthByCategory: CategoryTotal[]
}

export interface CategoryTotal {
  category: Category
  kgCo2e: number
}

export type Granularity = 'DAY' | 'WEEK' | 'MONTH'

export interface TrendBucket {
  start: string
  end: string
  total: number
  byCategory: Record<Category, number>
}

export interface Trend {
  from: string
  to: string
  granularity: Granularity
  buckets: TrendBucket[]
}

export interface PeriodTotals {
  from: string
  to: string
  total: number
  byCategory: CategoryTotal[]
}

export interface Comparison {
  current: PeriodTotals
  previous: PeriodTotals
  /** Omitted when the previous period is zero. */
  changePct?: number
  categories: { category: Category; current: number; previous: number; changePct?: number }[]
}

export interface BenchmarkReference {
  key: string
  label: string
  tonnesPerYear: number
  source: string
}

export interface Benchmarks {
  windowFrom?: string
  windowTo: string
  days: number
  windowKgCo2e: number
  /** Omitted until at least `minDays` are covered. */
  annualTonnes?: number
  minDays: number
  references: BenchmarkReference[]
}

// ---- Phase 4: templates, budget, baseline, what-if actions ----

export type Recurrence = 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY'

export interface Template {
  id: string
  name: string
  category: Category
  subtype: string
  label: string
  quantity: number
  unit: string
  passengers: number
  note?: string | null
  recurrence: Recurrence
  startsOn?: string | null
  nextRunOn?: string | null
  kgCo2e: number
  version: number
}

export interface TemplateInput {
  name: string
  category: Category
  subtype: string
  quantity: number
  passengers?: number
  note?: string
  recurrence: Recurrence
  startsOn?: string
  version?: number
}

export type BudgetStatus = 'ON_TRACK' | 'AT_RISK' | 'OVER'

export interface Goal {
  monthlyBudgetKg: number
  defaultBudget: boolean
  basis: string
  monthStart: string
  daysElapsed: number
  daysInMonth: number
  monthToDateKg: number
  projectedKg: number
  remainingKg: number
  status: BudgetStatus
}

export interface BaselineAnswers {
  householdSize: number
  carFuel?: CarFuel | null
  carKmPerWeek: number
  busKmPerWeek: number
  trainKmPerWeek: number
  shortHaulReturnFlightsPerYear: number
  longHaulReturnFlightsPerYear: number
  electricityKwhPerYear: number
  heatingType?: HeatingType | null
  heatingPerYear: number
  beefOrLambMealsPerWeek: number
  otherMeatMealsPerWeek: number
  vegan: boolean
  phonesPerYear: number
  laptopsPerYear: number
  clothingItemsPerYear: number
  residualWasteKgPerWeek: number
  recyclingKgPerWeek: number
}

export interface Baseline {
  answers: BaselineAnswers
  annualKg: number
  annualTonnes: number
  byCategory: { category: Category; annualKg: number }[]
  items: { category: Category; label: string; annualKg: number; basis: string }[]
  assumptions: string[]
  factorsOn: string
  savedAt?: string | null
}

export interface ReductionAction {
  key: string
  category: Category
  title: string
  description: string
  annualSavingKg: number
  basis: string
}

export interface Actions {
  windowDays: number
  from: string
  to: string
  actions: ReductionAction[]
  /** Adopted actions, with the saving measured since adoption once there are 7 days to compare. */
  commitments: Commitment[]
  /** Dismissed or snoozed suggestions, so they can be restored. */
  hidden: HiddenAction[]
}

export type DecisionStatus = 'ADOPTED' | 'DISMISSED' | 'SNOOZED'

export interface Commitment {
  key: string
  category: Category
  title: string
  adoptedOn: string
  daysSince: number
  expectedAnnualKg: number
  realisedAnnualKg?: number
  basis: string
}

export interface HiddenAction {
  key: string
  category: Category
  title: string
  status: Exclude<DecisionStatus, 'ADOPTED'>
  snoozedUntil?: string
}

export type ImportRowStatus = 'READY' | 'DUPLICATE' | 'ERROR' | 'IMPORTED'

export interface ImportRow {
  line: number
  status: ImportRowStatus
  message?: string
  date?: string
  label?: string
  quantity?: number
  unit?: string
  kgCo2e?: number
}

export interface ImportResult {
  dryRun: boolean
  ready: number
  duplicates: number
  errors: number
  imported: number
  rows: ImportRow[]
}

export type GridLevel = 'GREEN' | 'YELLOW' | 'RED'

/** Renewable share of the German grid (Energy-Charts), used only for timing advice, never for accounting. */
export interface GridSignal {
  source: 'ENERGY_CHARTS' | 'FALLBACK'
  /** True when the provider filled today from history instead of a forecast. */
  substitute: boolean
  points: { at: string; renewableShare: number; level: GridLevel }[]
  bestWindow: { from: string; to: string; avgShare: number } | null
  attribution: string
}

export type PlanSlot = 'MORNING' | 'MIDDAY' | 'EVENING' | 'ANYTIME'
export type PlanEffort = 'LOW' | 'MEDIUM' | 'HIGH'
export type PlanCardStatus = 'NEW' | 'ADOPTED' | 'DONE'
export type PlanEvent = 'ADOPTED' | 'DONE' | 'SNOOZED' | 'DISMISSED'

export interface PlanCard {
  key: string
  category: Category
  slot: PlanSlot
  title: string
  detail: string
  whyNow: string
  /** low = high × 0.7 (rebound); per TODAY or, for flights, per YEAR. */
  saving: { lowKg: number; highKg: number; per: 'TODAY' | 'YEAR' }
  effort: PlanEffort
  ifThen: string
  sources: { label: string; year: string }[]
  status: PlanCardStatus
  score: number
}

export interface TodayPlan {
  date: string
  cards: PlanCard[]
  grid: GridSignal
}

export interface CompareRow {
  subtype: string
  label: string
  unit: string
  kgCo2e: number
}

export interface CalculatorComparison {
  chosen: CompareRow
  /** Same category and unit, sorted by kgCo2e ascending. */
  alternatives: (CompareRow & { savingKg: number })[]
}
