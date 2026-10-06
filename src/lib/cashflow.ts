import type { ExtraIncome, FixedExpense, IncomeTemplate, SavingsAccount, SavingsMovement } from '../types'
import { fixedAppliesToMonth } from './fixedExpense'
import { templateAppliesToMonth } from './incomes'

/** Lançamento ainda não pago (de qualquer ano), só o que importa pro fluxo de caixa. */
export interface UnpaidTx {
  year: number
  month: number
  amount: number
  due_date: string | null
  card_id: string | null
}

export type IncomeRow = Pick<ExtraIncome, 'year' | 'month' | 'amount' | 'received' | 'template_id' | 'account_id'>

export interface Cashflow {
  /** past = mês já fechado; current = mês corrente; future = ainda não chegou. */
  kind: 'past' | 'current' | 'future'
  /** Saldo das contas no começo do mês. */
  initial: number
  /** Saldo das contas (já considerando só o que realmente entrou/saiu). */
  balance: number
  /** Saldo previsto no fim do mês: saldo + a receber − a pagar. */
  expected: number
  incomesPending: number
  /** Despesas a pagar no mês (contas, parcelas, gastos fixos) sem contar faturas de cartão. */
  expensesPending: number
  /** Compras de cartão da fatura do mês (a que aparece na lista do mês). */
  invoicesPending: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (y: number, m: number) => y * 12 + (m - 1)

interface Input {
  year: number
  month: number
  now: Date
  accounts: SavingsAccount[]
  movements: SavingsMovement[]
  unpaidTx: UnpaidTx[]
  incomeRows: IncomeRow[]
  templates: IncomeTemplate[]
  fixedExpenses: FixedExpense[]
  /** Gastos fixos já pagos no mês corrente. */
  paidFixedNow: Set<string>
}

/**
 * Saldo das contas bancárias mês a mês. Meses passados usam as movimentações reais; do mês
 * corrente em diante, cada mês começa com o previsto do anterior (+ receitas a receber − despesas a pagar).
 * Receitas a receber sem conta de destino não entram (elas não mexem no saldo das contas).
 */
export function computeCashflow(inp: Input): Cashflow {
  const contaIds = new Set(inp.accounts.filter((a) => a.kind === 'conta').map((a) => a.id))
  const moves = inp.movements.filter((m) => contaIds.has(m.account_id))
  const sum = (pred: (date: string) => boolean) =>
    moves.reduce((s, m) => {
      const d = m.occurred_on.slice(0, 10)
      if (!pred(d)) return s
      return s + (m.kind === 'deposito' ? Number(m.amount) : -Number(m.amount))
    }, 0)
  const startOf = (y: number, m: number) => `${y}-${pad(m)}-01`
  const endOf = (y: number, m: number) => `${y}-${pad(m)}-31`

  const curY = inp.now.getFullYear()
  const curM = inp.now.getMonth() + 1
  const curKey = keyOf(curY, curM)
  const tKey = keyOf(inp.year, inp.month)

  if (tKey < curKey) {
    const balance = sum((d) => d <= endOf(inp.year, inp.month))
    return {
      kind: 'past',
      initial: sum((d) => d < startOf(inp.year, inp.month)),
      balance,
      expected: balance,
      incomesPending: 0,
      expensesPending: 0,
      invoicesPending: 0,
    }
  }

  // despesas e receitas pendentes de um mês k (atrasadas caem no mês corrente)
  const bucket = (y: number, m: number) => Math.max(keyOf(y, m), curKey)
  // compra de cartão fica no mês da fatura dela (o mês em que ela aparece na lista); o resto, no mês do vencimento
  const txKey = (t: UnpaidTx) =>
    t.due_date && !t.card_id
      ? bucket(+t.due_date.slice(0, 4), +t.due_date.slice(5, 7))
      : bucket(t.year, t.month)

  const monthParts = (k: number) => {
    const y = Math.floor(k / 12)
    const m = (k % 12) + 1
    const other = inp.unpaidTx.filter((t) => !t.card_id && txKey(t) === k).reduce((s, t) => s + Number(t.amount), 0)
    const cards = inp.unpaidTx.filter((t) => t.card_id && txKey(t) === k).reduce((s, t) => s + Number(t.amount), 0)
    const fixed = inp.fixedExpenses
      .filter((f) => fixedAppliesToMonth(f, y, m))
      .filter((f) => (k === curKey ? !inp.paidFixedNow.has(f.id) : true))
      .reduce((s, f) => s + Number(f.amount), 0)
    // receitas pendentes (linhas a receber, e previstas de receitas fixas sem linha), só com conta
    const rowsHere = inp.incomeRows.filter((r) => r.year === y && r.month === m)
    const pendingRows = inp.incomeRows
      .filter((r) => !r.received && r.account_id && bucket(r.year, r.month) === k)
      .reduce((s, r) => s + Number(r.amount), 0)
    const virtual = inp.templates
      .filter(
        (t) =>
          t.account_id &&
          templateAppliesToMonth(t, y, m) &&
          !rowsHere.some((r) => r.template_id === t.id),
      )
      .reduce((s, t) => s + Number(t.amount), 0)
    return { incomes: pendingRows + virtual, expenses: other + fixed, invoices: cards }
  }

  let prevExpected = 0
  let result: Cashflow | null = null
  for (let k = curKey; k <= tKey; k++) {
    const p = monthParts(k)
    let initial: number
    let balance: number
    if (k === curKey) {
      initial = sum((d) => d < startOf(curY, curM))
      balance = sum((d) => d <= endOf(curY, curM))
    } else {
      initial = prevExpected
      balance = prevExpected
    }
    const expected = balance + p.incomes - p.expenses - p.invoices
    prevExpected = expected
    result = {
      kind: k === curKey ? 'current' : 'future',
      initial,
      balance,
      expected,
      incomesPending: p.incomes,
      expensesPending: p.expenses,
      invoicesPending: p.invoices,
    }
  }
  return result as Cashflow
}
