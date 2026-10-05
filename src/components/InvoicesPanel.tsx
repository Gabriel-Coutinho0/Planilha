import { useState } from 'react'
import type { Invoice } from '../lib/invoices'
import { formatBRL, formatDate, todayISO } from '../lib/format'

interface Props {
  invoices: Invoice[]
  hasCards: boolean
  onPay: (invoice: Invoice) => void
}

function dueLabel(dueDate: string, today: string): { text: string; tone: string } {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  const b = Date.UTC(+dueDate.slice(0, 4), +dueDate.slice(5, 7) - 1, +dueDate.slice(8, 10))
  const days = Math.round((b - a) / 86400000)
  if (days < 0) return { text: `venceu há ${-days} ${-days === 1 ? 'dia' : 'dias'}`, tone: 'text-rose-400' }
  if (days === 0) return { text: 'vence hoje', tone: 'text-rose-400' }
  if (days === 1) return { text: 'vence amanhã', tone: 'text-amber-300' }
  if (days <= 7) return { text: `vence em ${days} dias`, tone: 'text-amber-300' }
  return { text: `vence ${formatDate(dueDate)}`, tone: 'text-slate-400' }
}

export default function InvoicesPanel({ invoices, hasCards, onPay }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const today = todayISO()
  if (!hasCards) return null
  const total = invoices.reduce((s, i) => s + i.total, 0)

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Faturas em aberto</h3>
          <p className="text-[11px] text-slate-500">
            Compras no cartão agrupadas por vencimento. Pagar a fatura marca tudo como pago.
          </p>
        </div>
        {invoices.length > 0 && (
          <span className="text-sm font-bold text-rose-400 tabular-nums">{formatBRL(total)}</span>
        )}
      </div>

      {invoices.length === 0 ? (
        <p className="py-2 text-xs text-slate-400">Nenhuma fatura em aberto. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => {
            const due = dueLabel(inv.dueDate, today)
            const isOpen = open === inv.key
            const count = inv.txs.length + inv.fixed.length
            return (
              <li key={inv.key} className="rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpen(isOpen ? null : inv.key)}
                  >
                    <p className="truncate font-semibold text-slate-100">💳 {inv.card.name}</p>
                    <p className="text-[11px]">
                      <span className={due.tone}>{due.text}</span>
                      <span className="text-slate-500">
                        {' '}
                        · {count} {count === 1 ? 'item' : 'itens'} {isOpen ? '▾' : '▸'}
                      </span>
                    </p>
                  </button>
                  <span className="text-lg font-bold tabular-nums text-rose-300">
                    {formatBRL(inv.total)}
                  </span>
                  <button className="btn-primary px-3 py-1.5" onClick={() => onPay(inv)}>
                    Pagar fatura
                  </button>
                </div>
                {isOpen && (
                  <ul className="divide-y divide-slate-800 border-t border-slate-800 px-3 text-sm">
                    {inv.txs.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0 truncate text-slate-300">
                          {t.description}{' '}
                          <span className="text-[11px] text-slate-500">{formatDate(t.occurred_on)}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-300">
                          {formatBRL(Number(t.amount))}
                        </span>
                      </li>
                    ))}
                    {inv.fixed.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0 truncate text-slate-300">
                          {f.name} <span className="text-[11px] text-slate-500">gasto fixo</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-300">
                          {formatBRL(Number(f.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
