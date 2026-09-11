import { useMemo } from 'react'
import type { FixedExpense, Transaction } from '../types'
import { MONTHS_SHORT, formatBRL, formatDate, todayISO } from '../lib/format'
import MethodBadge from './MethodBadge'
import CategoryTag from './CategoryTag'
import BankTag from './BankTag'

interface Props {
  year: number
  /** Mostra contas até esse mês (ex: 9 = só até setembro; 0 = nenhuma; 12 = ano todo). */
  throughMonth: number
  /** Meses cujos gastos fixos não pagos devem aparecer aqui (ex: [9] = só setembro). */
  fixedMonths: number[]
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  isFixedPaid: (fixedExpenseId: string, month: number) => boolean
  onSetPaid: (id: string, paid: boolean) => Promise<void>
  onSetFixedPaid: (fixedExpenseId: string, month: number, paid: boolean) => Promise<void>
  onPostpone: (id: string) => Promise<void>
  onDeleteTransaction: (tx: Transaction) => void
}

type Row =
  | { kind: 'tx'; key: string; sort: string; tx: Transaction }
  | { kind: 'fixed'; key: string; sort: string; f: FixedExpense; month: number }

const pad = (n: number) => String(n).padStart(2, '0')

export default function BillsPanel({
  year,
  throughMonth,
  fixedMonths,
  transactions,
  fixedExpenses,
  isFixedPaid,
  onSetPaid,
  onSetFixedPaid,
  onPostpone,
  onDeleteTransaction,
}: Props) {
  const today = todayISO()

  const rows = useMemo<Row[]>(() => {
    const txRows: Row[] = transactions
      .filter((t) => !t.paid && t.month <= throughMonth)
      .map((t) => ({
        kind: 'tx',
        key: t.id,
        sort: t.due_date ?? t.occurred_on,
        tx: t,
      }))

    const fixedRows: Row[] = []
    for (const m of fixedMonths) {
      for (const f of fixedExpenses) {
        if (f.active && !isFixedPaid(f.id, m)) {
          fixedRows.push({
            kind: 'fixed',
            key: `${f.id}-${m}`,
            sort: `${year}-${pad(m)}-10`,
            f,
            month: m,
          })
        }
      }
    }
    return [...txRows, ...fixedRows].sort((a, b) => a.sort.localeCompare(b.sort))
  }, [transactions, fixedExpenses, isFixedPaid, fixedMonths, throughMonth, year])

  const total = rows.reduce(
    (s, r) => s + Number(r.kind === 'tx' ? r.tx.amount : r.f.amount),
    0,
  )
  const overdue = rows.filter((r) => r.kind === 'tx' && r.tx.due_date != null && r.tx.due_date < today)
  const overdueTotal = overdue.reduce(
    (s, r) => s + Number(r.kind === 'tx' ? r.tx.amount : 0),
    0,
  )

  return (
    <div id="contas-a-pagar" className="card scroll-mt-20 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Contas a pagar</h3>
          <p className="text-[11px] text-slate-500">
            {year} · mês corrente e atrasadas (parcelas futuras aparecem no mês delas)
          </p>
        </div>
        <div className="text-sm">
          <span className="font-bold text-amber-300 tabular-nums">{formatBRL(total)}</span>
          {overdue.length > 0 && (
            <span className="ml-2 text-xs font-semibold text-rose-400">
              {formatBRL(overdueTotal)} atrasado
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-3 text-xs text-slate-500">Nenhuma conta pendente. Tudo pago 🎉</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {rows.map((r) =>
            r.kind === 'fixed' ? (
              <li
                key={r.key}
                className="flex flex-col gap-1.5 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-2"
              >
                <div className="flex min-w-0 items-start gap-2 sm:flex-1">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => void onSetFixedPaid(r.f.id, r.month, true)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                    title="Marcar como pago"
                  />
                  <span className="w-8 shrink-0 text-[11px] font-semibold text-slate-500">
                    {MONTHS_SHORT[r.month - 1]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words">{r.f.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                        fixo
                      </span>
                      <CategoryTag category={r.f.category} />
                    </p>
                  </div>
                </div>
                <span className="shrink-0 self-end tabular-nums text-rose-300 sm:self-auto">
                  {formatBRL(Number(r.f.amount))}
                </span>
              </li>
            ) : (
              <BillTxRow
                key={r.key}
                tx={r.tx}
                today={today}
                onPaid={() => void onSetPaid(r.tx.id, true)}
                onPostpone={() => void onPostpone(r.tx.id)}
                onDelete={() => onDeleteTransaction(r.tx)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function BillTxRow({
  tx,
  today,
  onPaid,
  onPostpone,
  onDelete,
}: {
  tx: Transaction
  today: string
  onPaid: () => void
  onPostpone: () => void
  onDelete: () => void
}) {
  const isOverdue = tx.due_date != null && tx.due_date < today
  return (
    <li className="flex flex-col gap-1.5 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-2">
      <div className="flex min-w-0 items-start gap-2 sm:flex-1">
        <input
          type="checkbox"
          checked={false}
          onChange={onPaid}
          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
          title="Marcar como pago"
        />
        <span className="w-8 shrink-0 text-[11px] font-semibold text-slate-500">
          {MONTHS_SHORT[tx.month - 1]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words">{tx.description}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
            <MethodBadge method={tx.method} />
            <BankTag bank={tx.bank} />
            <CategoryTag category={tx.category} />
            <span className={isOverdue ? 'font-semibold text-rose-400' : ''}>
              {tx.due_date ? `vence ${formatDate(tx.due_date, true)}` : 'sem vencimento'}
              {isOverdue ? ' · atrasada' : ''}
            </span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <span className="tabular-nums text-rose-300">{formatBRL(Number(tx.amount))}</span>
        {isOverdue && (
          <button
            className="btn-ghost px-2 py-0.5 text-[11px]"
            onClick={onPostpone}
            title="Mover esta conta para o próximo mês"
          >
            adiar →
          </button>
        )}
        <button
          className="btn-danger px-2 py-0.5 text-xs"
          onClick={onDelete}
          title={tx.group_id ? 'Apagar parcelamento inteiro' : 'Remover'}
        >
          ✕
        </button>
      </div>
    </li>
  )
}
