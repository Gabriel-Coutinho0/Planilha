import type { Transaction } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Quanto do lançamento é gasto meu: o total, ou só a minha parte quando foi dividido. */
export function spent(t: Pick<Transaction, 'amount' | 'my_amount'>): number {
  return Number(t.my_amount ?? t.amount)
}

/** Divide `total` igualmente entre eu e `count` pessoas; a sobra dos centavos fica comigo. */
export function equalShares(total: number, count: number): { mine: number; each: number } {
  const each = Math.floor((total / (count + 1)) * 100) / 100
  return { each, mine: round2(total - each * count) }
}
