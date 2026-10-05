import type { Transaction } from '../types'

export interface Forecast {
  /** Quanto ainda deve sair no dia a dia (mercado, lanche…) além do que já está lançado. */
  extra: number
  /** Sobra prevista no fim do mês. */
  value: number
  basis: 'ritmo' | 'média' | 'nenhuma'
}

/** Gasto "do dia a dia": sem parcela, sem vencimento, sem ser recorrente. */
const everyday = (t: Transaction) => !t.group_id && !t.due_date && !t.recurring_id

/**
 * Previsão da sobra do mês: sobra atual (que já desconta fixos, parcelas e contas lançadas)
 * menos o que o seu ritmo de gastos do dia a dia ainda deve somar até o fim do mês.
 * Devolve null para meses que já passaram.
 */
export function monthForecast(opts: {
  transactions: Transaction[]
  year: number
  month: number
  remaining: number
  now?: Date
}): Forecast | null {
  const now = opts.now ?? new Date()
  const cur = now.getFullYear() * 12 + now.getMonth()
  const target = opts.year * 12 + (opts.month - 1)
  if (target < cur) return null

  const sumMonth = (m: number) =>
    opts.transactions
      .filter((t) => t.month === m && everyday(t))
      .reduce((s, t) => s + Number(t.amount), 0)

  const spentSoFar = sumMonth(opts.month)

  // média dos até 3 meses anteriores (do mesmo ano) que tiveram gasto do dia a dia
  const past: number[] = []
  for (let m = opts.month - 1; m >= 1 && past.length < 3; m--) {
    const v = sumMonth(m)
    if (v > 0) past.push(v)
  }
  const hist = past.length ? past.reduce((s, v) => s + v, 0) / past.length : null

  let expectedTotal: number
  let basis: Forecast['basis']
  if (target === cur) {
    const day = now.getDate()
    const daysInMonth = new Date(opts.year, opts.month, 0).getDate()
    if (day >= 7 && spentSoFar > 0) {
      expectedTotal = (spentSoFar / day) * daysInMonth
      basis = 'ritmo'
    } else if (hist != null) {
      expectedTotal = Math.max(hist, spentSoFar)
      basis = 'média'
    } else {
      expectedTotal = spentSoFar
      basis = 'nenhuma'
    }
  } else if (hist != null) {
    expectedTotal = hist
    basis = 'média'
  } else {
    expectedTotal = spentSoFar
    basis = 'nenhuma'
  }

  const extra = Math.max(0, expectedTotal - spentSoFar)
  return { extra, value: opts.remaining - extra, basis }
}
