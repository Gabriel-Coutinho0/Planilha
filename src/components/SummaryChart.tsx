import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthSummary } from '../types'
import { MONTHS_SHORT, formatBRL } from '../lib/format'

const AXIS = '#94a3b8'
const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 12,
}

export default function SummaryChart({ summaries }: { summaries: MonthSummary[] }) {
  const data = summaries.map((s) => ({
    mes: MONTHS_SHORT[s.month - 1],
    Salário: Math.round(s.salary),
    Gasto: Math.round(s.spent),
    Sobra: Math.round(s.remaining),
  }))

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">Salário x Gasto x Sobra</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="mes" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke={AXIS}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) =>
                v >= 1000
                  ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
                  : String(v)
              }
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
              itemStyle={{ color: '#e2e8f0' }}
              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              formatter={(v: number) => formatBRL(v)}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span style={{ color: '#cbd5e1' }}>{value}</span>}
            />
            <Bar dataKey="Salário" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="Gasto" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.Sobra >= 0 ? '#10b981' : '#f43f5e'} />
              ))}
            </Bar>
            <Line dataKey="Sobra" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
