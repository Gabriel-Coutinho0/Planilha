import type { Transaction } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Quanto do lançamento é gasto meu: o total, ou só a minha parte quando foi dividido. */
export function spent(t: Pick<Transaction, 'amount' | 'my_amount'>): number {
  return Number(t.my_amount ?? t.amount)
}

/** Linha do formulário de divisão: nome e valor digitado (vazio = parte igual). */
export interface SplitRow {
  name: string
  amount: string
}

/**
 * Calcula a divisão do formulário. Quem teve o valor digitado fica com ele; quem ficou em branco
 * divide igualmente o que sobra (junto comigo). `mine` negativo = as partes passam do total.
 */
export function resolveSplit(
  total: number,
  rows: SplitRow[],
  parse: (s: string) => number,
): { people: Array<{ name: string; amount: number; auto: boolean }>; mine: number; each: number } {
  const named = rows.filter((r) => r.name.trim())
  const typed = named.filter((r) => parse(r.amount) > 0)
  const blank = named.filter((r) => !(parse(r.amount) > 0))
  const typedSum = typed.reduce((s, r) => s + parse(r.amount), 0)
  const remainder = Math.max(0, total - typedSum)
  const each = Math.floor((remainder / (blank.length + 1)) * 100) / 100
  const people = named.map((r) => {
    const v = parse(r.amount)
    return v > 0 ? { name: r.name.trim(), amount: v, auto: false } : { name: r.name.trim(), amount: each, auto: true }
  })
  const mine = round2(total - people.reduce((s, p) => s + p.amount, 0))
  return { people, mine, each }
}

/** Divide `total` igualmente entre eu e `count` pessoas; a sobra dos centavos fica comigo. */
export function equalShares(total: number, count: number): { mine: number; each: number } {
  const each = Math.floor((total / (count + 1)) * 100) / 100
  return { each, mine: round2(total - each * count) }
}
