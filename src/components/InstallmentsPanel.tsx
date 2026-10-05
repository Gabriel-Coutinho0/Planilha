import type { Card } from '../types'
import type { InstallmentPlan } from '../lib/useInstallments'
import { MONTHS_SHORT, formatBRL, formatDate } from '../lib/format'

interface Props {
  plans: InstallmentPlan[]
  cards: Card[]
}

const monthYear = (iso: string) => `${MONTHS_SHORT[+iso.slice(5, 7) - 1]}/${iso.slice(0, 4)}`

export default function InstallmentsPanel({ plans, cards }: Props) {
  if (plans.length === 0) return null
  const totalRemaining = plans.reduce((s, p) => s + p.remainingAmount, 0)
  const monthly = plans.reduce((s, p) => s + p.perInstallment, 0)

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="text-sm font-semibold text-slate-200">Parcelamentos em andamento</h3>
          <p className="text-[11px] text-slate-500">
            {plans.length} {plans.length === 1 ? 'compra parcelada' : 'compras parceladas'} · ≈{' '}
            {formatBRL(monthly)} por mês em parcelas
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-500">ainda falta pagar</p>
          <p className="text-lg font-bold tabular-nums text-rose-300">{formatBRL(totalRemaining)}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {plans.map((p) => {
          const pct = p.total > 0 ? (p.paid / p.total) * 100 : 0
          const card = p.cardId ? cards.find((c) => c.id === p.cardId) : undefined
          return (
            <li key={p.groupId} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-semibold text-slate-100">
                  {p.name}
                  {card && <span className="ml-1.5 text-[11px] font-normal text-slate-500">💳 {card.name}</span>}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-rose-300">
                  {formatBRL(p.remainingAmount)}
                </span>
              </div>
              <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
              </div>
              <p className="flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-400">
                <span>
                  {p.paid} de {p.total} pagas · faltam {p.remainingCount} × {formatBRL(p.perInstallment)}
                </span>
                <span>
                  {p.nextDue && <>próxima {formatDate(p.nextDue)} · </>}termina em {monthYear(p.lastDue)}
                </span>
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
