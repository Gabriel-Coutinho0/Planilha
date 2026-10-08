import { useMemo, useState } from 'react'
import type { CategoryBudget, FixedExpense, Transaction } from '../types'
import { useCategories } from '../lib/categories'
import CategoryGlyph from './CategoryGlyph'
import { fixedSpent, spent as spentOf } from '../lib/split'
import { formatBRL } from '../lib/format'
import { fixedAppliesToMonth } from '../lib/fixedExpense'
import MoneyInput from './MoneyInput'

interface Props {
  year: number
  month: number
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  budgets: CategoryBudget[]
  onSetBudget: (category: string, amount: number) => Promise<void>
}

export default function BudgetsPanel({
  year,
  month,
  transactions,
  fixedExpenses,
  budgets,
  onSetBudget,
}: Props) {
  const [editing, setEditing] = useState(false)
  const { names } = useCategories()

  const spent = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.month !== month) continue
      const k = t.category || 'Sem categoria'
      map.set(k, (map.get(k) ?? 0) + spentOf(t))
    }
    for (const f of fixedExpenses) {
      if (!fixedAppliesToMonth(f, year, month)) continue
      const k = f.category || 'Sem categoria'
      map.set(k, (map.get(k) ?? 0) + fixedSpent(f))
    }
    return map
  }, [transactions, fixedExpenses, year, month])

  const rows = useMemo(
    () =>
      budgets
        .map((b) => {
          const s = spent.get(b.category) ?? 0
          return { category: b.category, budget: Number(b.amount), spent: s, pct: s / Number(b.amount) }
        })
        .filter((r) => r.budget > 0)
        .sort((a, b) => b.pct - a.pct),
    [budgets, spent],
  )

  const budgetOf = (c: string) => Number(budgets.find((b) => b.category === c)?.amount ?? 0)

  return (
    <div className="mb-4 rounded-xl bg-slate-800/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-300">Orçamento do mês</h3>
        <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setEditing((v) => !v)}>
          {editing ? 'pronto' : rows.length === 0 ? 'definir orçamento' : 'editar'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Limite mensal por categoria (0 = sem limite).</p>
          {names.map((c) => (
            <div key={c} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <CategoryGlyph category={c} className="h-3.5 w-3.5" />
                {c}
              </span>
              <MoneyInput
                value={budgetOf(c)}
                onCommit={(v) => void onSetBudget(c, v)}
                className="w-32"
                ariaLabel={`Orçamento de ${c}`}
              />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500">
          Defina quanto quer gastar por categoria e acompanhe aqui, com alerta de cor.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const over = r.pct > 1
            const tone = over ? 'bg-rose-400' : r.pct >= 0.8 ? 'bg-amber-400' : 'bg-emerald-400'
            return (
              <li key={r.category}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-300">{r.category}</span>
                  <span className={`tabular-nums ${over ? 'font-semibold text-rose-300' : 'text-slate-400'}`}>
                    {formatBRL(r.spent)} de {formatBRL(r.budget)}
                    {over && ` · estourou ${formatBRL(r.spent - r.budget)}`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${tone}`}
                    style={{ width: `${Math.min(100, r.pct * 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
