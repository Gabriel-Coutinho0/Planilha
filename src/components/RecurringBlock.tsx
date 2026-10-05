import { useState } from 'react'
import type { Card, RecurringExpense, Transaction } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import { cardDueDate } from '../lib/cards'

interface Props {
  year: number
  month: number
  items: RecurringExpense[]
  /** Lançamentos do ano carregado (pra saber o que já foi lançado e o último valor). */
  transactions: Transaction[]
  cards: Card[]
  onLaunch: (t: {
    month: number
    description: string
    amount: number
    occurred_on: string
    paid: boolean
    due_date: string | null
    method: RecurringExpense['method']
    category: string | null
    bank: string | null
    card_id: string | null
    recurring_id: string
  }) => Promise<void>
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Lembretes dos recorrentes que ainda não foram lançados neste mês. */
export default function RecurringBlock({ year, month, items, transactions, cards, onLaunch }: Props) {
  const now = new Date()
  const isFuture = year * 12 + month > now.getFullYear() * 12 + now.getMonth() + 1
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  if (isFuture) return null

  const done = new Set(
    transactions.filter((t) => t.month === month && t.recurring_id).map((t) => t.recurring_id as string),
  )
  const pending = items.filter((i) => i.active && !done.has(i.id))
  if (pending.length === 0) return null

  // último valor lançado de cada recorrente (no ano carregado), pra sugerir
  const lastAmount = (id: string): number | null => {
    const last = transactions
      .filter((t) => t.recurring_id === id)
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))[0]
    return last ? Number(last.amount) : null
  }

  async function launch(item: RecurringExpense) {
    const text = amounts[item.id]
    const value = text != null ? parseAmount(text) : (lastAmount(item.id) ?? Number(item.amount))
    if (value <= 0) return
    setBusyId(item.id)
    const lastDay = new Date(year, month, 0).getDate()
    const day = item.day ? Math.min(item.day, lastDay) : Math.min(now.getDate(), lastDay)
    const date = `${year}-${pad(month)}-${pad(day)}`
    const card = item.card_id ? cards.find((c) => c.id === item.card_id) : undefined
    const hasDue = item.day != null
    await onLaunch({
      month,
      description: item.name,
      amount: value,
      occurred_on: date,
      paid: !hasDue && !card,
      due_date: card ? cardDueDate(card, date) : hasDue ? date : null,
      method: item.method,
      category: item.category,
      bank: card ? card.bank || card.name : item.bank,
      card_id: card?.id ?? null,
      recurring_id: item.id,
    })
    setAmounts((a) => {
      const { [item.id]: _removed, ...rest } = a
      return rest
    })
    setBusyId(null)
  }

  return (
    <div className="mb-4 rounded-xl border border-sky-900/60 bg-sky-950/20 p-3">
      <h3 className="mb-2 text-sm font-semibold text-sky-200">
        Pra lançar neste mês <span className="text-sky-400/70">({pending.length})</span>
      </h3>
      <ul className="space-y-2">
        {pending.map((it) => {
          const suggested = lastAmount(it.id) ?? Number(it.amount)
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 text-slate-200">
                {it.name}
                {it.day && <span className="ml-1.5 text-[11px] text-slate-500">vence dia {it.day}</span>}
                <span className="ml-1.5 text-[11px] text-slate-500">
                  último/média {formatBRL(suggested)}
                </span>
              </span>
              <input
                className="input w-28 py-1 text-right"
                inputMode="decimal"
                placeholder={suggested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                value={amounts[it.id] ?? ''}
                onChange={(e) => setAmounts((a) => ({ ...a, [it.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void launch(it)
                }}
                aria-label={`Valor de ${it.name} neste mês`}
              />
              <button
                className="btn-primary px-3 py-1"
                disabled={busyId === it.id}
                onClick={() => void launch(it)}
              >
                Lançar
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
