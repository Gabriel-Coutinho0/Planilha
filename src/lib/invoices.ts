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

  // Gasto fixo no cartão não tem data própria: entra na próxima fatura a vencer
  // (o próximo vencimento do cartão a partir de hoje), junto das compras dessa fatura.
  for (const f of pendingFixed) {
    const card = f.card_id ? cardById.get(f.card_id) : undefined
    if (!card) continue
    const dueDate = nextDueDate(card, now)
    const key = `${card.id}|${dueDate}`
    const inv = map.get(key) ?? { key, card, dueDate, txs: [], fixed: [], total: 0 }
    inv.fixed.push(f)
    inv.total += Number(f.amount)
    map.set(key, inv)
  }

  return [...map.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/** Próximo vencimento do cartão em ou depois de hoje (YYYY-MM-DD). */
function nextDueDate(card: Card, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const dueIn = (y: number, m: number) => Math.min(card.due_day, new Date(y, m, 0).getDate())
  let y = now.getFullYear()
  let m = now.getMonth() + 1
  if (dueIn(y, m) < now.getDate()) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return `${y}-${pad(m)}-${pad(dueIn(y, m))}`
}
