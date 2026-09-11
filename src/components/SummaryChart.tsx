import { useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
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
const kFormat = (v: number) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
    : String(v)

type Mode = 'monthly' | 'cumulative'

export default function SummaryChart({ summaries }: { summaries: MonthSummary[] }) {
  const [mode, setMode] = useState<Mode>('monthly')

  const monthlyData = useMemo(
    () =>
      summaries.map((s) => ({
        mes: MONTHS_SHORT[s.month - 1],
        Salário: Math.round(s.salary),
        Gasto: Math.round(s.spent),
        Sobra: Math.round(s.remaining),
      })),
    [summaries],
  )

  const cumulativeData = useMemo(() => {
    let acc = 0
    return summaries.map((s) => {
      acc += s.remaining
      return { mes: MONTHS_SHORT[s.month - 1], Acumulado: Math.round(acc) }
    })
  }, [summaries])

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          {mode === 'monthly' ? 'Salário x Gasto x Sobra' : 'Sobra acumulada no ano'}
        </h3>
        <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
          <button
            className={`rounded-md px-2.5 py-1 transition ${
              mode === 'monthly' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
            onClick={() => setMode('monthly')}
          >
            Mês a mês
          </button>
          <button
            className={`rounded-md px-2.5 py-1 transition ${
              mode === 'cumulative' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
            onClick={() => setMode('cumulative')}
          >
            Acumulado
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer>
          {mode === 'monthly' ? (
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="mes" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={kFormat}
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
                {monthlyData.map((d, i) => (
                  <Cell key={i} fill={d.Sobra >= 0 ? '#10b981' : '#f43f5e'} />
                ))}
              </Bar>
              <Line dataKey="Sobra" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          ) : (
            <ComposedChart data={cumulativeData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="acumuladoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="mes" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke={AXIS}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={kFormat}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(v: number) => formatBRL(v)}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
              <Area
                dataKey="Acumulado"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#acumuladoFill)"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
      {mode === 'cumulative' && (
        <p className="mt-2 text-[11px] text-slate-500">
          Soma da sobra mês a mês — mostra se a reserva do ano está subindo ou caindo.
        </p>
      )}
    </div>
  )
}
