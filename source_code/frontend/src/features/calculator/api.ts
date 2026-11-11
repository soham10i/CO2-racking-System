import { api } from '../../api/client'
import type { ActivityInput, CalculatorComparison } from '../../api/types'

/** Same body as /calculator/estimate; nothing is logged. */
export const compare = (input: Omit<ActivityInput, 'note' | 'version'>) =>
  api<CalculatorComparison>('/calculator/compare', { method: 'POST', body: input })
