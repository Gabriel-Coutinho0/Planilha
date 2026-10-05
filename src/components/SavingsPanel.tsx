import type { SavingsAccount, SavingsKind } from '../types'
import { SAVINGS_KIND_LABEL } from '../types'
import { formatBRL } from '../lib/format'
import MoneyInput from './MoneyInput'

const KIND_STYLE: Record<SavingsKind, string> = {
  conta: 'bg-amber-500/15 text-amber-300',
  caixinha: 'bg-sky-500/15 text-sky-300',
  investimento: 'bg-violet-500/15 text-violet-300',
}

interface Props {
  accounts: SavingsAccount[]
  balanceOf: (id: string) => number
  yieldOf: (id: string) => number
  cdiRate: number
  onSetCdiRate: (value: number) => void
  totals: { contas: number; caixinhas: number; investimentos: number; total: number }
  loading: boolean
  onNew: () => void
  onOpen: (account: SavingsAccount) => void
}

export default function SavingsPanel({
  accounts,
  balanceOf,
  yieldOf,
  cdiRate,
  onSetCdiRate,
  totals,
  loading,
  onNew,
  onOpen,
}: Props) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Contas, caixinhas e investimentos</h3>
          <p className="text-[11px] text-slate-500">
            Em conta: {formatBRL(totals.contas)} · Guardado: {formatBRL(totals.caixinhas)} · Investido:{' '}
            {formatBRL(totals.investimentos)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-emerald-400 tabular-nums">
            {formatBRL(totals.total)}
          </span>
          <button className="btn-ghost px-3 py-1.5" onClick={onNew}>
            + Nova
          </button>
        </div>
      </div>

      {accounts.some((a) => a.cdi_percent) && (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-400">
          <span>CDI atual (ao ano)</span>
          <div className="w-28">
            <MoneyInput value={cdiRate} onCommit={onSetCdiRate} ariaLabel="CDI atual ao ano" />
          </div>
          <span>% · base do rendimento estimado</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800/40" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <p className="py-3 text-xs text-slate-400">
          Nenhuma conta, caixinha ou investimento ainda. Clique em "+ Nova" pra começar.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {accounts.map((a) => {
            const bal = balanceOf(a.id)
            return (
              <li key={a.id}>
                <button
                  onClick={() => onOpen(a)}
                  className="flex w-full flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left transition hover:border-slate-600 hover:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-100">{a.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLE[a.kind]}`}
                    >
                      {SAVINGS_KIND_LABEL[a.kind]}
                    </span>
                  </div>
                  <span
                    className={`text-lg font-bold tabular-nums ${bal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {formatBRL(bal)}
                  </span>
                  {a.cdi_percent ? (
                    <span className="text-[11px] text-emerald-400/80">
                      rende {a.cdi_percent}% do CDI · rendeu {formatBRL(yieldOf(a.id))}
                    </span>
                  ) : null}
                  {a.institution && (
                    <span className="text-[11px] text-slate-500">guardado em {a.institution}</span>
                  )}
                  {!a.include_in_patrimony && (
                    <span className="text-[10px] text-slate-600">fora do patrimônio</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
