import { useMemo } from 'react'
import type { Transaction } from '../types'
import { MONTHS_SHORT, formatBRL, formatDate, todayISO } from '../lib/format'
import MethodBadge from './MethodBadge'

interface Props {
  year: number
  transactions: Transaction[]
  onSetPaid: (id: string, paid: boolean) => Promise<void>
  onPostpone: (id: string) => Promise<void>
  onRemove: (id: string, groupId?: string | null) => Promise<number>
}

export default function BillsPanel({ year, transactions, onSetPaid, onPostpone, onRemove }: Props) {
  const today = todayISO()

  const pending = useMemo(
    () =>
      transactions
        .filter((t) => !t.paid)
        .sort((a, b) => (a.due_date ?? a.occurred_on).localeCompare(b.due_date ?? b.occurred_on)),
    [transactions],
  )

  const total = pending.reduce((s, t) => s + Number(t.amount), 0)
  const overdue = pending.filter((t) => t.due_date != null && t.due_date < today)
  const overdueTotal = overdue.reduce((s, t) => s + Number(t.amount), 0)

  async function remove(t: Transaction) {
    if (t.group_id) {
      const n = transactions.filter((x) => x.group_id === t.group_id).length
      if (!confirm(`"${t.description}" é um parcelamento. Apagar todas as ${n} parcelas?`)) return
      await onRemove(t.id, t.group_id)
    } else {
      await onRemove(t.id)
    }
  }

  return (
    <div id="contas-a-pagar" className="card scroll-mt-20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-300">Contas a pagar em {year}</h3>
        <div className="text-sm">
          <span className="font-bold text-amber-300 tabular-nums">{formatBRL(total)}</span>
          {overdue.length > 0 && (
            <span className="ml-2 text-xs font-semibold text-rose-400">
              {formatBRL(overdueTotal)} atrasado
            </span>
          )}
        </div>
      </div>

      {pending.length === 0 ? (
        <p className="py-3 text-xs text-slate-500">Nenhuma conta pendente. Tudo pago 🎉</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {pending.map((t) => {
            const isOverdue = t.due_date != null && t.due_date < today
            return (
              <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => void onSetPaid(t.id, true)}
                  className="h-4 w-4 shrink-0 accent-emerald-500"
                  title="Marcar como pago"
                />
                <span className="w-8 shrink-0 text-[11px] font-semibold text-slate-500">
                  {MONTHS_SHORT[t.month - 1]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{t.description}</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <MethodBadge method={t.method} />
                    <span className={isOverdue ? 'font-semibold text-rose-400' : ''}>
                      {t.due_date ? `vence ${formatDate(t.due_date, true)}` : 'sem vencimento'}
                      {isOverdue ? ' · atrasada' : ''}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-rose-300">
                  {formatBRL(Number(t.amount))}
                </span>
                {isOverdue && (
                  <button
                    className="btn-ghost shrink-0 px-2 py-0.5 text-[11px]"
                    onClick={() => void onPostpone(t.id)}
                    title="Mover esta conta para o próximo mês"
                  >
                    adiar →
                  </button>
                )}
                <button
                  className="btn-danger shrink-0 px-2 py-0.5 text-xs"
                  onClick={() => void remove(t)}
                  title={t.group_id ? 'Apagar parcelamento inteiro' : 'Remover'}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
