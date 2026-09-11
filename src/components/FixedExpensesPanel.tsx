import { useState, type FormEvent } from 'react'
import type { FixedExpense } from '../types'
import { CATEGORIES } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import MoneyInput from './MoneyInput'
import CategoryTag from './CategoryTag'

interface Props {
  items: FixedExpense[]
  onAdd: (name: string, amount: number, category?: string | null) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<FixedExpense, 'name' | 'amount' | 'active' | 'category'>>,
  ) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export default function FixedExpensesPanel({ items, onAdd, onUpdate, onRemove }: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)

  const total = items.filter((i) => i.active).reduce((s, i) => s + Number(i.amount), 0)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const v = parseAmount(amount)
    if (!n) return
    setBusy(true)
    await onAdd(n, v, category || null)
    setName('')
    setAmount('')
    setCategory('')
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
          <li key={it.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2 sm:flex-1">
              <input
                type="checkbox"
                checked={it.active}
                onChange={(e) => void onUpdate(it.id, { active: e.target.checked })}
                className="h-4 w-4 shrink-0 accent-emerald-500"
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
              <span className="hidden sm:block">
                <CategoryTag category={it.category} />
              </span>
            </div>
            <div className="flex items-center gap-2 pl-6 sm:pl-0">
              <select
                className="input w-full sm:w-32"
                value={it.category ?? ''}
                onChange={(e) => void onUpdate(it.id, { category: e.target.value || null })}
              >
                <option value="">Categoria…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <MoneyInput
                value={Number(it.amount)}
                onCommit={(v) => void onUpdate(it.id, { amount: v })}
                className="w-24 shrink-0"
                ariaLabel={`Valor de ${it.name}`}
              />
              <button
                className="btn-danger shrink-0 px-2 py-1 text-xs"
                onClick={() => void onRemove(it.id)}
                title="Remover"
              >
                ✕
              </button>
            </div>
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
        <select
          className="input w-full basis-full sm:w-36 sm:basis-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Categoria…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
