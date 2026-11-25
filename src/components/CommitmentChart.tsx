import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FixedExpense } from '../types'
import type { CommittedRow } from '../lib/useCommitments'
import { MONTHS_SHORT, formatBRL } from '../lib/format'
import { fixedForMonth } from '../lib/fixedExpense'

import { AXIS, COLOR, GRID, TOOLTIP_STYLE, kFormat } from '../lib/chartStyle'

interface Props {
  rows: CommittedRow[]
  fixedExpenses: FixedExpense[]
  /** Renda prevista de um mês (receitas fixas, salário do mês ou salário padrão). */
  incomeOf: (year: number, month: number) => number
}

export default function CommitmentChart({ rows, fixedExpenses, incomeOf }: Props) {
  const data = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const fixos = fixedForMonth(fixedExpenses, y, m)
        .reduce((s, f) => s + Number(f.amount), 0)
      const monthRows = rows.filter((r) => r.year === y && r.month === m)
      const parcelas = monthRows.filter((r) => r.group_id).reduce((s, r) => s + r.amount, 0)
      const outras = monthRows.filter((r) => !r.group_id).reduce((s, r) => s + r.amount, 0)
      const total = fixos + parcelas + outras
      const renda = incomeOf(y, m)
      return {
        mes: `${MONTHS_SHORT[m - 1]}${m === 1 || i === 0 ? `/${String(y).slice(2)}` : ''}`,
        Fixos: Math.round(fixos),
        Parcelas: Math.round(parcelas),
        'Outras contas': Math.round(outras),
        'Renda prevista': Math.round(renda),
        total,
        livre: renda - total,
      }
    })
  }, [rows, fixedExpenses, incomeOf])

  const freest = data.reduce((best, d) => (d.livre > best.livre ? d : best), data[0])
  const tightest = data.reduce((worst, d) => (d.livre < worst.livre ? d : worst), data[0])
  const hasInstallments = data.some((d) => d.Parcelas > 0)

  return (
    <div className="card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Comprometimento dos próximos 12 meses</h3>
        <p className="text-[11px] text-slate-500">
          Gastos fixos + parcelas + contas já lançadas, comparados à renda prevista de cada mês
        </p>
      </div>

      <div className="h-64" role="img" aria-label="Comprometimento da renda nos próximos 12 meses">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="mes" stroke={AXIS} fontSize={11} tickLine={false} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} tickFormatter={kFormat} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number) => formatBRL(v)}
              cursor={{ fill: '#1e293b66' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Fixos" stackId="a" fill={COLOR.fixed} />
            <Bar dataKey="Parcelas" stackId="a" fill={COLOR.installments} />
            <Bar dataKey="Outras contas" stackId="a" fill={COLOR.others} radius={[4, 4, 0, 0]} />
            <Line dataKey="Renda prevista" stroke={COLOR.income} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-200">
          Mês mais livre: <strong>{freest.mes}</strong> · sobram {formatBRL(freest.livre)} depois do
          comprometido
        </p>
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-rose-200">
          Mês mais apertado: <strong>{tightest.mes}</strong> ·{' '}
          {tightest.livre >= 0
            ? `sobram ${formatBRL(tightest.livre)}`
            : `faltam ${formatBRL(-tightest.livre)}`}
        </p>
      </div>
      {!hasInstallments && (
        <p className="mt-2 text-[11px] text-slate-500">
          Nenhuma parcela futura cadastrada ainda: o gráfico mostra só os gastos fixos.
        </p>
      )}
    </div>
  )
}
