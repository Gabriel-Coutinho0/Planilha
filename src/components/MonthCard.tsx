import type { MonthSummary } from '../types'
import { MONTHS, formatBRL } from '../lib/format'

interface Props {
  summary: MonthSummary
  txCount: number
  isCurrent: boolean
  onOpen: () => void
}

export default function MonthCard({ summary, txCount, isCurrent, onOpen }: Props) {
  const { remaining, salary, spent } = summary
  const positive = remaining >= 0
  const pct = salary > 0 ? Math.min(100, Math.max(0, (spent / salary) * 100)) : spent > 0 ? 100 : 0

  return (
    <button
      onClick={onOpen}
      className={`card group flex flex-col gap-3 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900 ${
        isCurrent ? 'ring-1 ring-emerald-500/40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{MONTHS[summary.month - 1]}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
          {txCount} lanç.
        </span>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Sobra</p>
        <p className={`text-lg font-bold tabular-nums ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatBRL(remaining)}
        </p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between text-[11px] text-slate-400">
        <span>Salário {formatBRL(salary)}</span>
        <span>Gasto {formatBRL(spent)}</span>
      </div>
    </button>
  )
}
