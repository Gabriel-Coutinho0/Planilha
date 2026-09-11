import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Transaction } from '../types'
import { MONTHS, MONTHS_SHORT, formatBRL, formatDate } from '../lib/format'
import MethodBadge from './MethodBadge'
import CategoryTag from './CategoryTag'

interface Props {
  year: number
  transactions: Transaction[]
}

type Period = 'year' | number

const PALETTE = [
  '#34d399',
  '#60a5fa',
  '#f59e0b',
  '#f472b6',
  '#a78bfa',
  '#22d3ee',
  '#fb7185',
  '#c084fc',
  '#facc15',
  '#4ade80',
]
const NO_BANK = 'Sem banco'
const NO_BANK_COLOR = '#64748b'

function colorFor(name: string): string {
  if (name === NO_BANK) return NO_BANK_COLOR
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export default function BankChart({ year, transactions }: Props) {
  const [period, setPeriod] = useState<Period>('year')
  const [selected, setSelected] = useState<string | null>(null)

  const periodTx = useMemo(
    () => (period === 'year' ? transactions : transactions.filter((t) => t.month === period)),
    [transactions, period],
  )

  const data = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of periodTx) {
      const key = t.bank || NO_BANK
      map.set(key, (map.get(key) ?? 0) + Number(t.amount))
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [periodTx])

  const selectedStillVisible = selected != null && data.some((d) => d.name === selected)
  const active = selectedStillVisible ? selected : null

  const total = data.reduce((s, d) => s + d.value, 0)

  const detailRows = useMemo(() => {
    if (!active) return null
    return periodTx
      .filter((t) => (t.bank || NO_BANK) === active)
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
      .map((t) => ({
        key: t.id,
        label: t.description,
        meta: `${MONTHS_SHORT[t.month - 1]} · ${formatDate(t.occurred_on)}`,
        amount: Number(t.amount),
        method: t.method,
        category: t.category,
      }))
  }, [active, periodTx])

  function toggle(name: string) {
    setSelected((cur) => (cur === name ? null : name))
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Gastos por banco</h3>
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

        {active && (
          <button
            className="ml-auto flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
            onClick={() => setSelected(null)}
          >
            {active} ✕
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <p className="py-3 text-xs text-slate-400">Sem lançamentos com banco neste período.</p>
      ) : (
        <>
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
                    onClick={(d) => toggle(d.name)}
                    cursor="pointer"
                  >
                    {data.map((d) => (
                      <Cell
                        key={d.name}
                        fill={colorFor(d.name)}
                        opacity={active && active !== d.name ? 0.25 : 1}
                      />
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
                <li key={d.name}>
                  <button
                    onClick={() => toggle(d.name)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left transition ${
                      active === d.name ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                    } ${active && active !== d.name ? 'opacity-50' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: colorFor(d.name) }}
                      />
                      <span className="truncate text-slate-200">{d.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-300 tabular-nums">
                      {total > 0 ? Math.round((d.value / total) * 100) : 0}% · {formatBRL(d.value)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {detailRows && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <p className="mb-2 text-xs font-semibold text-slate-400">
                {detailRows.length} {detailRows.length === 1 ? 'lançamento' : 'lançamentos'} em{' '}
                <span className="text-slate-200">{active}</span>
              </p>
              {detailRows.length === 0 ? (
                <p className="text-xs text-slate-500">Nada por aqui.</p>
              ) : (
                <ul className="max-h-64 divide-y divide-slate-800 overflow-y-auto">
                  {detailRows.map((r) => (
                    <li key={r.key} className="flex items-center gap-2 py-1.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-slate-200">{r.label}</p>
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <MethodBadge method={r.method} />
                          <CategoryTag category={r.category} />
                          <span>{r.meta}</span>
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-slate-300">
                        {formatBRL(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
