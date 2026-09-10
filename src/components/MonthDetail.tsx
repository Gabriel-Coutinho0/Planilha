import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { MonthSummary, Transaction } from '../types'
import { MONTHS, formatBRL, parseAmount } from '../lib/format'
import MoneyInput from './MoneyInput'

interface Props {
  year: number
  summary: MonthSummary
  transactions: Transaction[]
  hasSalaryOverride: boolean
  onClose: () => void
  onSetMonthSalary: (month: number, value: number) => Promise<void>
  onAddTransaction: (t: { month: number; description: string; amount: number; occurred_on: string }) => Promise<void>
  onRemoveTransaction: (id: string) => Promise<void>
}

export default function MonthDetail({
  year,
  summary,
  transactions,
  hasSalaryOverride,
  onClose,
  onSetMonthSalary,
  onAddTransaction,
  onRemoveTransaction,
}: Props) {
  const { month } = summary
  const rows = useMemo(
    () => transactions.filter((t) => t.month === month),
    [transactions, month],
  )

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate(year, month))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0) return
    setBusy(true)
    await onAddTransaction({
      month,
      description: desc.trim() || 'Sem descrição',
      amount: v,
      occurred_on: date,
    })
    setDesc('')
    setAmount('')
    setBusy(false)
  }

  const positive = summary.remaining >= 0

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {MONTHS[month - 1]} <span className="text-slate-500">{year}</span>
            </h2>
            <p className={`text-sm font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              Sobra {formatBRL(summary.remaining)}
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-[11px] uppercase text-slate-500">Salário do mês</p>
            <MoneyInput
              value={summary.salary}
              onCommit={(v) => void onSetMonthSalary(month, v)}
              className="mt-1"
              ariaLabel="Salário do mês"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {hasSalaryOverride ? 'Valor específico deste mês' : 'Usando o salário padrão'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-[11px] uppercase text-slate-500">Gasto do mês</p>
            <p className="mt-2 text-lg font-bold text-rose-400 tabular-nums">{formatBRL(summary.spent)}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Fixos {formatBRL(summary.fixedTotal)} + variáveis {formatBRL(summary.variableTotal)}
            </p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-300">Lançamentos variáveis</h3>
        <ul className="mb-3 divide-y divide-slate-800">
          {rows.length === 0 && (
            <li className="py-3 text-xs text-slate-500">Nada lançado neste mês.</li>
          )}
          {rows.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-14 shrink-0 text-[11px] text-slate-500">
                {t.occurred_on.slice(8, 10)}/{t.occurred_on.slice(5, 7)}
              </span>
              <span className="flex-1 truncate">{t.description}</span>
              <span className="tabular-nums text-rose-300">{formatBRL(Number(t.amount))}</span>
              <button
                className="btn-danger px-2 py-0.5 text-xs"
                onClick={() => void onRemoveTransaction(t.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAdd} className="space-y-2 rounded-xl bg-slate-800/40 p-3">
          <input
            className="input"
            placeholder="Descrição (ex: mercado, uber, farmácia)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="input w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              className="input flex-1"
              placeholder="Valor 0,00"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Salvando…' : 'Adicionar lançamento'}
          </button>
        </form>
      </div>
    </div>
  )
}

function defaultDate(year: number, month: number): string {
  const now = new Date()
  const day =
    now.getFullYear() === year && now.getMonth() + 1 === month
      ? String(now.getDate()).padStart(2, '0')
      : '01'
  return `${year}-${String(month).padStart(2, '0')}-${day}`
}
