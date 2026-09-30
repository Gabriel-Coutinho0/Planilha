import type { FixedExpense } from '../types'

/** Se um gasto fixo está ativo e dentro do período (start/end) configurado num mês/ano. */
export function fixedAppliesToMonth(f: FixedExpense, year: number, month: number): boolean {
  if (!f.active) return false
  if (f.start_year != null && f.start_month != null) {
    if (year < f.start_year || (year === f.start_year && month < f.start_month)) return false
  }
  if (f.end_year != null && f.end_month != null) {
    if (year > f.end_year || (year === f.end_year && month > f.end_month)) return false
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
  if (period === 'year') return Number(f.amount) * fixedMonthsInYear(f, year)
  return fixedAppliesToMonth(f, year, period) ? Number(f.amount) : 0
}
