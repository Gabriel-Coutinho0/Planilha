import type { Transaction } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Quanto do lançamento é gasto meu: o total, ou só a minha parte quando foi dividido. */
export function spent(t: Pick<Transaction, 'amount' | 'my_amount'>): number {
  return Number(t.my_amount ?? t.amount)
}

/** Linha do formulário de divisão: nome e valor digitado. */
export interface SplitRow {
  name: string
  amount: string
}

/**
 * Calcula a divisão do formulário: cada pessoa com nome e valor > 0 fica com o valor digitado.
 * `each` é a parte igual (entre todas as pessoas com nome e eu); `mine` negativo = as partes passam do total.
 */
export function resolveSplit(
  total: number,
  rows: SplitRow[],
  parse: (s: string) => number,
): { people: Array<{ name: string; amount: number }>; mine: number; each: number; named: number } {
  const named = rows.filter((r) => r.name.trim())
  const people = named
    .map((r) => ({ name: r.name.trim(), amount: parse(r.amount) }))
    .filter((p) => p.amount > 0)
  const each = Math.floor((total / (named.length + 1)) * 100) / 100
  const mine = round2(total - people.reduce((s, p) => s + p.amount, 0))
  return { people, mine, each, named: named.length }
}

/** Divide `total` igualmente entre eu e `count` pessoas; a sobra dos centavos fica comigo. */
export function equalShares(total: number, count: number): { mine: number; each: number } {
  const each = Math.floor((total / (count + 1)) * 100) / 100
  return { each, mine: round2(total - each * count) }
}
