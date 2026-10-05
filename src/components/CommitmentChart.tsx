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
import { fixedAppliesToMonth } from '../lib/fixedExpense'

const AXIS = '#94a3b8'
const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 12,
}
const kFormat = (v: number) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
    : String(v)

interface Props {
  rows: CommittedRow[]
  fixedExpenses: FixedExpense[]
  defaultSalary: number
}

export default function CommitmentChart({ rows, fixedExpenses, defaultSalary }: Props) {
  const data = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const fixos = fixedExpenses
        .filter((f) => fixedAppliesToMonth(f, y, m))
        .reduce((s, f) => s + Number(f.amount), 0)
      const monthRows = rows.filter((r) => r.year === y && r.month === m)
      const parcelas = monthRows.filter((r) => r.group_id).reduce((s, r) => s + r.amount, 0)
      const outras = monthRows.filter((r) => !r.group_id).reduce((s, r) => s + r.amount, 0)
      const total = fixos + parcelas + outras
      return {
        mes: `${MONTHS_SHORT[m - 1]}${m === 1 || i === 0 ? `/${String(y).slice(2)}` : ''}`,
        Fixos: Math.round(fixos),
        Parcelas: Math.round(parcelas),
        'Outras contas': Math.round(outras),
        Salário: Math.round(defaultSalary),
        total,
        livre: defaultSalary - total,
      }
    })
  }, [rows, fixedExpenses, defaultSalary])

  const freest = data.reduce((best, d) => (d.livre > best.livre ? d : best), data[0])
  const tightest = data.reduce((worst, d) => (d.livre < worst.livre ? d : worst), data[0])
  const hasInstallments = data.some((d) => d.Parcelas > 0)

  return (
    <div className="card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Comprometimento dos próximos 12 meses</h3>
        <p className="text-[11px] text-slate-500">
          Gastos fixos + parcelas + contas já lançadas, comparados ao salário padrão
        </p>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="mes" stroke={AXIS} fontSize={11} tickLine={false} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} tickFormatter={kFormat} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number) => formatBRL(v)}
              cursor={{ fill: '#1e293b66' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Fixos" stackId="a" fill="#a3b2c7" />
            <Bar dataKey="Parcelas" stackId="a" fill="#a78bfa" />
            <Bar dataKey="Outras contas" stackId="a" fill="#fb7185" radius={[4, 4, 0, 0]} />
            <Line dataKey="Salário" stroke="#34d399" strokeWidth={2} dot={false} />
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
