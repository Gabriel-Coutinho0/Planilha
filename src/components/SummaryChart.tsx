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

export default function SummaryChart({ summaries }: { summaries: MonthSummary[] }) {
  const data = summaries.map((s) => ({
    mes: MONTHS_SHORT[s.month - 1],
    Salário: Math.round(s.salary),
    Gasto: Math.round(s.spent),
    Sobra: Math.round(s.remaining),
  }))

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">Salário x Gasto x Sobra</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v: number) => formatBRL(v)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Salário" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="Gasto" radius={[4, 4, 0, 0]} maxBarSize={26}>
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
