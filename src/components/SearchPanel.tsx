import { useMemo, useState } from 'react'
import type { Card, PaymentMethod, Transaction } from '../types'
import { METHOD_LABEL } from '../types'
import { MONTHS, formatBRL, formatDate } from '../lib/format'
import BankTag from './BankTag'
import CategoryTag from './CategoryTag'
import MethodBadge from './MethodBadge'
import CategoryOptions from './CategoryOptions'

interface Props {
  year: number
  transactions: Transaction[]
  cards: Card[]
  onOpenMonth: (month: number) => void
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SearchPanel({ year, transactions, cards, onOpenMonth }: Props) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [bank, setBank] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [status, setStatus] = useState<'' | 'paid' | 'unpaid'>('')

  const banks = useMemo(
    () => [...new Set(transactions.map((t) => t.bank).filter((b): b is string => !!b))].sort(),
    [transactions],
  )
  const cardName = (id: string | null) => (id ? cards.find((c) => c.id === id)?.name ?? '' : '')

  const results = useMemo(() => {
    const term = norm(q.trim())
    return transactions
      .filter((t) => {
        if (category && (t.category ?? '') !== category) return false
        if (bank && (t.bank ?? '') !== bank) return false
        if (method && t.method !== method) return false
        if (status === 'paid' && !t.paid) return false
        if (status === 'unpaid' && t.paid) return false
        if (!term) return true
        const amountText = Number(t.amount).toFixed(2).replace('.', ',')
        const haystack = norm(
          [t.description, t.note, t.bank, t.category, cardName(t.card_id)].filter(Boolean).join(' '),
        )
        return haystack.includes(term) || amountText.includes(term.replace('.', ','))
      })
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, q, category, bank, method, status, cards])

  const total = results.reduce((s, t) => s + Number(t.amount), 0)
  const filtering = q.trim() !== '' || category || bank || method || status

  const byMonth = useMemo(() => {
    const map = new Map<number, Transaction[]>()
    for (const t of results) {
      const arr = map.get(t.month)
      if (arr) arr.push(t)
      else map.set(t.month, [t])
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [results])

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Buscar lançamentos em {year}</h2>
      <input
        className="input mb-2"
        placeholder="Descrição, observação, banco, categoria ou valor (ex: 49,90)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Categoria…</option>
          <CategoryOptions />
        </select>
        <select className="input" value={bank} onChange={(e) => setBank(e.target.value)}>
          <option value="">Banco…</option>
          {banks.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
        >
          <option value="">Forma…</option>
          {(Object.entries(METHOD_LABEL) as [PaymentMethod, string][]).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | 'paid' | 'unpaid')}
        >
          <option value="">Pago e a pagar</option>
          <option value="paid">Só pagos</option>
          <option value="unpaid">Só a pagar</option>
        </select>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          {!filtering && ' (digite ou filtre pra refinar)'}
        </span>
        <span className="font-semibold tabular-nums text-slate-300">{formatBRL(total)}</span>
      </div>

      {results.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">Nada encontrado.</p>
      ) : (
        <div className="space-y-4">
          {byMonth.map(([m, list]) => (
            <div key={m}>
              <button
                className="mb-1 flex w-full items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200"
                onClick={() => onOpenMonth(m)}
                title="Abrir este mês"
              >
                <span>{MONTHS[m - 1]} →</span>
                <span className="tabular-nums text-slate-500">
                  {formatBRL(list.reduce((s, t) => s + Number(t.amount), 0))}
                </span>
              </button>
              <ul className="divide-y divide-slate-800">
                {list.map((t) => (
                  <li
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 py-2 text-sm hover:bg-slate-800/30"
                    onClick={() => onOpenMonth(t.month)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-200">{t.description}</p>
                      <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500">
                        <MethodBadge method={t.method} />
                        <BankTag bank={cardName(t.card_id) ? `💳 ${cardName(t.card_id)}` : t.bank} />
                        <CategoryTag category={t.category} />
                        <span>{formatDate(t.due_date ?? t.occurred_on)}</span>
                        {!t.paid && <span className="text-amber-300">a pagar</span>}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-rose-300">
                      {formatBRL(Number(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
