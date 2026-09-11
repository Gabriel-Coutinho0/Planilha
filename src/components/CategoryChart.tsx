import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Transaction } from '../types'
import { CATEGORY_COLOR } from '../types'
import { MONTHS, formatBRL } from '../lib/format'

interface Props {
  year: number
  transactions: Transaction[]
  fixedMonthly: number
}

type Period = 'year' | number

export default function CategoryChart({ year, transactions, fixedMonthly }: Props) {
  const [period, setPeriod] = useState<Period>('year')
  const [includeFixed, setIncludeFixed] = useState(true)

  const data = useMemo(() => {
    const filtered =
      period === 'year' ? transactions : transactions.filter((t) => t.month === period)
    const map = new Map<string, number>()
    for (const t of filtered) {
      const key = t.category || 'Sem categoria'
      map.set(key, (map.get(key) ?? 0) + Number(t.amount))
    }
    if (includeFixed && fixedMonthly > 0) {
      const fixedAmount = period === 'year' ? fixedMonthly * 12 : fixedMonthly
      map.set('Fixos', fixedAmount)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, fixedMonthly, period, includeFixed])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Gastos por categoria</h3>
        <span className="text-sm font-semibold text-slate-300 tabular-nums">{formatBRL(total)}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
          <button
            className={`rounded-md px-2.5 py-1 transition ${
              period === 'year' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
            onClick={() => setPeriod('year')}
          >
            {year}
          </button>
          <select
            className={`rounded-md bg-transparent px-2 py-1 outline-none ${
              period !== 'year' ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
            value={period === 'year' ? '' : period}
            onChange={(e) => setPeriod(e.target.value ? Number(e.target.value) : 'year')}
          >
            <option value="" disabled>
              Mês…
            </option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-emerald-500"
            checked={includeFixed}
            onChange={(e) => setIncludeFixed(e.target.checked)}
          />
          incluir fixos
        </label>
      </div>

      {data.length === 0 ? (
        <p className="py-3 text-xs text-slate-400">
          {includeFixed ? 'Sem gastos neste período.' : 'Sem lançamentos categorizados neste período.'}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-52 w-52 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={CATEGORY_COLOR[d.name] ?? CATEGORY_COLOR['Outro']} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number) => formatBRL(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="grid w-full grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {data.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: CATEGORY_COLOR[d.name] ?? CATEGORY_COLOR['Outro'] }}
                  />
                  <span className="truncate text-slate-200">{d.name}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-300 tabular-nums">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}% · {formatBRL(d.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
