import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORY_COLOR } from '../types'
import { formatBRL } from '../lib/format'

interface Props {
  data: { name: string; value: number }[]
  year: number
}

export default function CategoryChart({ data, year }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Gastos por categoria — {year}</h3>
        <span className="text-xs text-slate-500 tabular-nums">{formatBRL(total)}</span>
      </div>

      {data.length === 0 ? (
        <p className="py-3 text-xs text-slate-500">Sem lançamentos para categorizar ainda.</p>
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
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
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
                  <span className="truncate text-slate-300">{d.name}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400 tabular-nums">
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
