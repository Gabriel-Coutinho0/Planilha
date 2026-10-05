import type { Card, FixedExpense, Transaction } from '../types'
import { cardDueDate } from './cards'

export interface Invoice {
  key: string
  card: Card
  /** Vencimento da fatura (YYYY-MM-DD). */
  dueDate: string
  txs: Transaction[]
  /** Gastos fixos cobrados no cartão neste mês (entram na fatura que vence no mês corrente). */
  fixed: FixedExpense[]
  total: number
}

/** Agrupa as compras não pagas de cada cartão por vencimento (uma fatura por cartão e data). */
export function buildInvoices(
  cards: Card[],
  pendingTx: Transaction[],
  pendingFixed: FixedExpense[],
  now: Date,
): Invoice[] {
  const map = new Map<string, Invoice>()
  const cardById = new Map(cards.map((c) => [c.id, c]))

  for (const t of pendingTx) {
    const card = t.card_id ? cardById.get(t.card_id) : undefined
    if (!card) continue
    const dueDate = (t.due_date ?? cardDueDate(card, t.occurred_on)).slice(0, 10)
    const key = `${card.id}|${dueDate}`
    const inv = map.get(key) ?? { key, card, dueDate, txs: [], fixed: [], total: 0 }
    inv.txs.push(t)
    inv.total += Number(t.amount)
    map.set(key, inv)
  }

  // gastos fixos do mês corrente: vão na fatura do cartão que vence neste mês
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const prefix = `${y}-${String(m).padStart(2, '0')}`
  for (const f of pendingFixed) {
    const card = f.card_id ? cardById.get(f.card_id) : undefined
    if (!card) continue
    const existing = [...map.values()].find(
      (i) => i.card.id === card.id && i.dueDate.startsWith(prefix),
    )
    const inv =
      existing ??
      (() => {
        const last = new Date(y, m, 0).getDate()
        const dueDate = `${prefix}-${String(Math.min(card.due_day, last)).padStart(2, '0')}`
        const created: Invoice = { key: `${card.id}|${dueDate}`, card, dueDate, txs: [], fixed: [], total: 0 }
        map.set(created.key, created)
        return created
      })()
    inv.fixed.push(f)
    inv.total += Number(f.amount)
  }

  return [...map.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
