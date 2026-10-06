import { useState } from 'react'
import type { Cashflow } from '../lib/cashflow'
import { MONTHS, formatBRL } from '../lib/format'

interface Props {
  year: number
  month: number
  flow: Cashflow
  hasAccounts: boolean
}

const tone = (v: number) => (v >= 0 ? 'text-emerald-300' : 'text-rose-300')

/** Saldo das contas no mês: Inicial → Saldo (o que já aconteceu) → Previsto (com o que falta entrar e sair). */
export default function CashflowCard({ year, month, flow, hasAccounts }: Props) {
  if (!hasAccounts) {
    return (
      <div className="mb-4 rounded-xl bg-slate-800/30 p-3 text-xs text-slate-400">
        Cadastre uma <strong className="text-slate-300">conta bancária</strong> em "Contas, caixinhas e
        investimentos" pra ver o saldo mês a mês.
      </div>
    )
  }
  const past = flow.kind === 'past'
  const [details, setDetails] = useState(false)
  return (
    <div className="mb-4 rounded-xl bg-slate-800/30 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-300">
          Saldo das contas · {MONTHS[month - 1]} {year}
        </h3>
        <span className="text-[11px] text-slate-500">
          {past ? 'mês encerrado' : flow.kind === 'current' ? 'mês atual' : 'previsão'}
        </span>
      </div>

      <div className={`grid gap-2 text-center ${past ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-[10px] uppercase text-slate-500">Inicial</p>
          <p className={`text-sm font-bold tabular-nums ${tone(flow.initial)}`}>{formatBRL(flow.initial)}</p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2">
          <p className="text-[10px] uppercase text-slate-500">{past ? 'Final' : 'Saldo'}</p>
          <p className={`text-sm font-bold tabular-nums ${tone(flow.balance)}`}>{formatBRL(flow.balance)}</p>
        </div>
        {!past && (
          <div className="rounded-lg bg-slate-800/50 p-2">
            <p className="text-[10px] uppercase text-slate-500">Previsto</p>
            <p className={`text-sm font-bold tabular-nums ${tone(flow.expected)}`}>{formatBRL(flow.expected)}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="mt-2 text-[11px] font-medium text-slate-400 hover:text-slate-200"
        onClick={() => setDetails((v) => !v)}
        aria-expanded={details}
      >
        {details ? '▾ esconder detalhes' : '▸ ver detalhes'}
      </button>

      {details && !past && (
        <ul className="mt-2 space-y-1 text-xs">
          <li className="flex justify-between text-slate-400">
            <span>🕓 Receitas a receber</span>
            <span className="tabular-nums text-emerald-300">+ {formatBRL(flow.incomesPending)}</span>
          </li>
          <li className="flex justify-between text-slate-400">
            <span>Despesas a pagar</span>
            <span className="tabular-nums text-rose-300">− {formatBRL(flow.expensesPending)}</span>
          </li>
          <li className="flex justify-between text-slate-400">
            <span>💳 Faturas de cartão a pagar</span>
            <span className="tabular-nums text-rose-300">− {formatBRL(flow.invoicesPending)}</span>
          </li>
        </ul>
      )}
      {details && (
      <p className="mt-2 text-[11px] text-slate-500">
        Só contas bancárias. O saldo muda quando você recebe uma receita ou desconta um gasto da conta; o
        previsto soma o que falta entrar e sair. Atrasados caem no mês atual. O previsto de um mês é o
        inicial do seguinte.
      </p>
      )}
    </div>
  )
}
