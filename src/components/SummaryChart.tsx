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
import { AXIS, COLOR, GRID, TOOLTIP_ITEM, TOOLTIP_LABEL, TOOLTIP_STYLE, kFormat } from '../lib/chartStyle'

type Mode = 'monthly' | 'cumulative'

interface Props {
  year: number
  summaries: MonthSummary[]
}

/** Renda x gasto x sobra do ano. Meses que ainda não chegaram aparecem mais claros e tracejados (previsto). */
export default function SummaryChart({ year, summaries }: Props) {
  const [mode, setMode] = useState<Mode>('monthly')
  const now = new Date()
  const nowKey = now.getFullYear() * 12 + now.getMonth() + 1
  const isFuture = (m: number) => year * 12 + m > nowKey
  // o mês atual liga o realizado ao previsto (a linha tracejada começa nele)
  const isBridge = (m: number) => year * 12 + m === nowKey

  const monthlyData = useMemo(
    () =>
      summaries.map((s) => {
        const future = isFuture(s.month)
        const sobra = Math.round(s.remaining)
        return {
          mes: MONTHS_SHORT[s.month - 1],
          future,
          Renda: Math.round(s.salary),
          Gasto: Math.round(s.spent),
          Sobra: future ? null : sobra,
          'Sobra prevista': future || isBridge(s.month) ? sobra : null,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summaries, year, nowKey],
  )

  const cumulativeData = useMemo(() => {
    let acc = 0
    return summaries.map((s) => {
      acc += s.remaining
      const future = isFuture(s.month)
      const v = Math.round(acc)
      return {
        mes: MONTHS_SHORT[s.month - 1],
        Acumulado: future ? null : v,
        'Acumulado previsto': future || isBridge(s.month) ? v : null,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, year, nowKey])

  const hasFuture = monthlyData.some((d) => d.future)
  const futureLabels = new Set(monthlyData.filter((d) => d.future).map((d) => d.mes))
  const labelFormatter = (l: string) => (futureLabels.has(l) ? `${l} (previsto)` : l)
  const tooltip = (
    <Tooltip
      contentStyle={TOOLTIP_STYLE}
      labelStyle={TOOLTIP_LABEL}
      itemStyle={TOOLTIP_ITEM}
      cursor={{ fill: 'rgba(148,163,184,0.08)' }}
      labelFormatter={labelFormatter}
      formatter={(v: number) => formatBRL(v)}
    />
  )
  const axes = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="mes" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
      <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={56} tickFormatter={kFormat} />
    </>
  )

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          {mode === 'monthly' ? 'Renda x Gasto x Sobra' : 'Sobra acumulada no ano'}
        </h3>
        <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
          {(
            [
              ['monthly', 'Mês a mês'],
              ['cumulative', 'Acumulado'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              aria-pressed={mode === v}
              className={`rounded-md px-2.5 py-1 transition ${mode === v ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
              onClick={() => setMode(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-72 w-full"
        role="img"
        aria-label={
          mode === 'monthly'
            ? `Renda, gasto e sobra por mês de ${year}${hasFuture ? '; meses futuros são previsão' : ''}`
            : `Sobra acumulada mês a mês em ${year}`
        }
      >
        <ResponsiveContainer>
          {mode === 'monthly' ? (
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {axes}
              {tooltip}
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: '#cbd5e1' }}>{v}</span>} />
              <Bar dataKey="Renda" fill={COLOR.income} radius={[4, 4, 0, 0]} maxBarSize={26}>
                {monthlyData.map((d, i) => (
                  <Cell key={i} fill={COLOR.income} fillOpacity={d.future ? 0.35 : 0.85} />
                ))}
              </Bar>
              <Bar dataKey="Gasto" fill={COLOR.spent} radius={[4, 4, 0, 0]} maxBarSize={26}>
                {monthlyData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.Gasto > d.Renda ? COLOR.over : COLOR.spent}
                    fillOpacity={d.future ? 0.35 : 0.85}
                  />
                ))}
              </Bar>
              <Line dataKey="Sobra" stroke={COLOR.balance} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              {hasFuture && (
                <Line
                  dataKey="Sobra prevista"
                  stroke={COLOR.balance}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeOpacity={0.7}
                  dot={{ r: 3, fillOpacity: 0.4 }}
                />
              )}
            </ComposedChart>
          ) : (
            <ComposedChart data={cumulativeData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="acumuladoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR.balance} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLOR.balance} stopOpacity={0} />
                </linearGradient>
              </defs>
              {axes}
              {tooltip}
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
              <Area dataKey="Acumulado" stroke={COLOR.balance} strokeWidth={2} fill="url(#acumuladoFill)" dot={{ r: 3 }} />
              {hasFuture && (
                <Line
                  dataKey="Acumulado previsto"
                  stroke={COLOR.balance}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeOpacity={0.7}
                  dot={{ r: 3, fillOpacity: 0.4 }}
                />
              )}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {mode === 'cumulative'
          ? 'Soma da sobra mês a mês: mostra se a reserva do ano está subindo ou caindo. '
          : 'Gasto em vermelho quando passa da renda do mês. '}
        {hasFuture && 'Meses que ainda não chegaram aparecem mais claros e tracejados: são previsão (só fixos, parcelas e contas já lançadas).'}
      </p>
    </div>
  )
}
