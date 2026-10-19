import type { FixedChange, FixedExpense } from '../types'
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

/** O gasto fixo com o valor (e a minha parte) que valem num mês, considerando os reajustes. */
export function fixedAt(f: FixedExpense, year: number, month: number): FixedExpense {
  const key = year * 12 + month
  let best: FixedChange | null = null
  for (const c of f.changes ?? []) {
    const k = c.from_year * 12 + c.from_month
    if (k <= key && (!best || k > best.from_year * 12 + best.from_month)) best = c
  }
  if (!best) return f
  return { ...f, amount: Number(best.amount), my_amount: best.my_amount }
}

/** Os gastos fixos que valem num mês, já com o valor daquele mês. */
export function fixedForMonth(list: FixedExpense[], year: number, month: number): FixedExpense[] {
  return list.filter((f) => fixedAppliesToMonth(f, year, month)).map((f) => fixedAt(f, year, month))
}

/** Valor total do gasto fixo num período: um mês específico, ou o ano inteiro (soma só os meses em que ele vale). */
export function fixedAmountForPeriod(f: FixedExpense, year: number, period: 'year' | number): number {
  if (period === 'year') {
    let sum = 0
    for (let m = 1; m <= 12; m++) if (fixedAppliesToMonth(f, year, m)) sum += fixedSpent(fixedAt(f, year, m))
    return sum
  }
  return fixedAppliesToMonth(f, year, period) ? fixedSpent(fixedAt(f, year, period)) : 0
}
