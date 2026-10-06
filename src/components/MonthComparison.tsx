import { useEffect, useMemo, useState } from 'react'
import type { FixedExpense, Transaction } from '../types'
import CategoryGlyph from './CategoryGlyph'
import { spent } from '../lib/split'
import { MONTHS, formatBRL, formatDate } from '../lib/format'
import { fixedAppliesToMonth } from '../lib/fixedExpense'

interface Props {
  year: number
  month: number
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  loadMonth: (year: number, month: number) => Promise<Transaction[]>
}

function byCategory(txs: Transaction[], fixed: FixedExpense[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    const k = t.category || 'Sem categoria'
    map.set(k, (map.get(k) ?? 0) + spent(t))
  }
  for (const f of fixed) {
    const k = f.category || 'Sem categoria'
    map.set(k, (map.get(k) ?? 0) + Number(f.amount))
  }
  return map
}

const pctText = (cur: number, prev: number) => {
  if (prev <= 0) return cur > 0 ? 'novo' : '—'
  const p = ((cur - prev) / prev) * 100
  return `${p >= 0 ? '+' : ''}${p.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
}

export default function MonthComparison({ year, month, transactions, fixedExpenses, loadMonth }: Props) {
  const [open, setOpen] = useState(false)
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const [prevRows, setPrevRows] = useState<Transaction[] | null>(null)

  // dezembro do ano anterior não está carregado: busca só nesse caso
  useEffect(() => {
    if (month !== 1) return
    let cancelled = false
    loadMonth(prev.y, prev.m)
      .then((r) => !cancelled && setPrevRows(r))
      .catch(() => !cancelled && setPrevRows([]))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  const data = useMemo(() => {
    const curTx = transactions.filter((t) => t.month === month)
    const prevTx = month === 1 ? (prevRows ?? []) : transactions.filter((t) => t.month === prev.m)
    const curFixed = fixedExpenses.filter((f) => fixedAppliesToMonth(f, year, month))
    const prevFixed = fixedExpenses.filter((f) => fixedAppliesToMonth(f, prev.y, prev.m))
    const cur = byCategory(curTx, curFixed)
    const old = byCategory(prevTx, prevFixed)
    const cats = [...new Set([...cur.keys(), ...old.keys()])]
      .map((c) => ({
        category: c,
        cur: cur.get(c) ?? 0,
        prev: old.get(c) ?? 0,
        delta: (cur.get(c) ?? 0) - (old.get(c) ?? 0),
      }))
      .filter((r) => r.cur > 0 || r.prev > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    const totalCur = [...cur.values()].reduce((s, v) => s + v, 0)
    const totalPrev = [...old.values()].reduce((s, v) => s + v, 0)
    const top = [...curTx].sort((a, b) => spent(b) - spent(a)).slice(0, 5)
    return { cats, totalCur, totalPrev, top }
  }, [transactions, fixedExpenses, prevRows, year, month, prev.y, prev.m])

  const diff = data.totalCur - data.totalPrev

  return (
    <div className="mb-4 rounded-xl bg-slate-800/30 p-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-x-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-slate-300">
          Comparação com {MONTHS[prev.m - 1].toLowerCase()} {open ? '▾' : '▸'}
        </h3>
        <span
          className={`text-xs font-semibold tabular-nums ${diff > 0 ? 'text-rose-300' : 'text-emerald-300'}`}
        >
          {data.totalPrev > 0
            ? `${diff > 0 ? '+' : ''}${formatBRL(diff)} (${pctText(data.totalCur, data.totalPrev)})`
            : 'sem dados do mês anterior'}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Por categoria (fixos + lançamentos)
            </p>
            <ul className="space-y-1.5">
              {data.cats.slice(0, 8).map((r) => {
                const up = r.delta > 0
                return (
                  <li key={r.category} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-slate-300">
                      <CategoryGlyph category={r.category} className="h-3.5 w-3.5" />
                      <span className="truncate">{r.category}</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="text-slate-300">{formatBRL(r.cur)}</span>
                      <span className={`ml-2 text-xs ${r.delta === 0 ? 'text-slate-500' : up ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {pctText(r.cur, r.prev)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Vermelho = gastou mais que no mês anterior; verde = gastou menos.
            </p>
          </div>

          {data.top.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Maiores lançamentos do mês
              </p>
              <ul className="divide-y divide-slate-800">
                {data.top.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-slate-300">
                      {t.description}
                      <span className="ml-1.5 text-[11px] text-slate-500">
                        {formatDate(t.due_date ?? t.occurred_on)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-rose-300">{formatBRL(spent(t))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
