import { useState, type FormEvent } from 'react'
import type { FixedExpense } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import MoneyInput from './MoneyInput'

interface Props {
  items: FixedExpense[]
  onAdd: (name: string, amount: number) => Promise<void>
  onUpdate: (id: string, patch: Partial<Pick<FixedExpense, 'name' | 'amount' | 'active'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export default function FixedExpensesPanel({ items, onAdd, onUpdate, onRemove }: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const total = items.filter((i) => i.active).reduce((s, i) => s + Number(i.amount), 0)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const v = parseAmount(amount)
    if (!n) return
    setBusy(true)
    await onAdd(n, v)
    setName('')
    setAmount('')
    setBusy(false)
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Gastos fixos (todo mês)</h3>
        <span className="text-sm font-bold text-rose-400 tabular-nums">{formatBRL(total)}</span>
      </div>

      <ul className="mb-3 divide-y divide-slate-800">
        {items.length === 0 && (
          <li className="py-3 text-xs text-slate-500">Nenhum gasto fixo cadastrado ainda.</li>
        )}
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={it.active}
              onChange={(e) => void onUpdate(it.id, { active: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
              title={it.active ? 'Ativo' : 'Ignorado no cálculo'}
            />
            <input
              className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-slate-800"
              defaultValue={it.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== it.name) void onUpdate(it.id, { name: v })
              }}
            />
            <MoneyInput
              value={Number(it.amount)}
              onCommit={(v) => void onUpdate(it.id, { amount: v })}
              className="w-28 shrink-0"
              ariaLabel={`Valor de ${it.name}`}
            />
            <button
              className="btn-danger px-2 py-1 text-xs"
              onClick={() => void onRemove(it.id)}
              title="Remover"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          className="input basis-full sm:flex-1"
          placeholder="Ex: Aluguel, Academia, Internet…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-28 flex-1 sm:flex-none"
          placeholder="0,00"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={busy}>
          Adicionar
        </button>
      </form>
    </div>
  )
}
