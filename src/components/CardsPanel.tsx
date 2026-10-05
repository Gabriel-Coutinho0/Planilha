import type { Card } from '../types'
import { formatBRL } from '../lib/format'

interface Props {
  cards: Card[]
  loading: boolean
  usedOf: (cardId: string) => number
  availableOf: (card: Card) => number
  onNew: () => void
  onEdit: (card: Card) => void
}

export default function CardsPanel({ cards, loading, usedOf, availableOf, onNew, onEdit }: Props) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Cartões de crédito</h3>
          <p className="text-[11px] text-slate-500">
            Limite usado = compras no cartão ainda não pagas
          </p>
        </div>
        <button className="btn-ghost px-3 py-1.5" onClick={onNew}>
          + Cartão
        </button>
      </div>

      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-slate-800/40" />
      ) : cards.length === 0 ? (
        <p className="py-3 text-xs text-slate-400">
          Nenhum cartão cadastrado. Clique em "+ Cartão" ou cadastre direto ao lançar uma compra no cartão.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cards.map((c) => {
            const used = usedOf(c.id)
            const limit = Number(c.credit_limit)
            const available = availableOf(c)
            const pct = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0
            return (
              <li key={c.id}>
                <button
                  onClick={() => onEdit(c)}
                  className="flex w-full flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left transition hover:border-slate-600 hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-100">💳 {c.name}</span>
                    {c.bank && (
                      <span className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                        {c.bank}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-slate-500">disponível</span>
                    <span
                      className={`text-lg font-bold tabular-nums ${available >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {formatBRL(available)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>
                      usado {formatBRL(used)} de {formatBRL(limit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>fecha dia {c.closing_day}</span>
                    <span>vence dia {c.due_day}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
