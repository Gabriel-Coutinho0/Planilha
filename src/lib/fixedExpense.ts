import type { FixedExpense } from '../types'
import { fixedSpent } from './split'

/** Se um gasto fixo está ativo e já começou a valer (a partir do start) num mês/ano. */
export function fixedAppliesToMonth(f: FixedExpense, year: number, month: number): boolean {
  if (!f.active) return false
  if (f.start_year != null && f.start_month != null) {
    if (year < f.start_year || (year === f.start_year && month < f.start_month)) return false
  }
  return true
}

/** Quantos meses de um ano (1 a 12) esse gasto fixo se aplica. */
export function fixedMonthsInYear(f: FixedExpense, year: number): number {
  let count = 0
  for (let m = 1; m <= 12; m++) if (fixedAppliesToMonth(f, year, m)) count++
  return count
}

/** Valor total do gasto fixo num período: um mês específico, ou o ano inteiro (soma só os meses em que ele vale). */
export function fixedAmountForPeriod(f: FixedExpense, year: number, period: 'year' | number): number {
  if (period === 'year') return fixedSpent(f) * fixedMonthsInYear(f, year)
  return fixedAppliesToMonth(f, year, period) ? fixedSpent(f) : 0
}
