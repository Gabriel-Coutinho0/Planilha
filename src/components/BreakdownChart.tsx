import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Card, FixedExpense, PaymentMethod, Transaction } from '../types'
import { METHOD_LABEL } from '../types'
import { useCategories } from '../lib/categories'
import { fixedAmountForPeriod, fixedMonthsInYear } from '../lib/fixedExpense'
import { spent } from '../lib/split'
import { MONTHS_SHORT, formatBRL, formatDate } from '../lib/format'
import { PALETTE, TOOLTIP_ITEM, TOOLTIP_LABEL, TOOLTIP_STYLE } from '../lib/chartStyle'
import CategoryGlyph from './CategoryGlyph'
import CategoryTag from './CategoryTag'
import MethodBadge from './MethodBadge'
import PeriodPicker from './PeriodPicker'

type Period = 'year' | number
/** category = por categoria; method = por forma de pagamento; bank = por banco. */
type Dimension = 'category' | 'method' | 'bank'
type View = 'bars' | 'donut'

interface Props {
  year: number
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  cards: Card[]
  /** Mês da visão mensal: o gráfico acompanha ele (null = ano inteiro). */
  month: number | null
  /** 'category' = gráfico de categorias; 'payment' = forma de pagamento (ou banco, alternável). */
  kind: 'category' | 'payment'
}

const NO_CATEGORY = 'Sem categoria'
const FIXED_NO_CATEGORY = 'Fixos'
const NO_METHOD = 'Sem forma'
const NO_BANK = 'Sem banco'
const NEUTRAL = '#64748b'

const METHOD_COLOR: Record<PaymentMethod, string> = {
  cartao: '#a78bfa',
  pix: '#22d3ee',
  boleto: '#f59e0b',
  dinheiro: '#34d399',
  outro: '#94a3b8',
}
const methodName = (m: PaymentMethod | null | undefined) => (m ? METHOD_LABEL[m] : NO_METHOD)
const METHOD_BY_LABEL = new Map(Object.entries(METHOD_LABEL).map(([k, v]) => [v, k as PaymentMethod]))

const VIEW_KEY = 'chart-view'
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'donut' ? 'donut' : 'bars'
  } catch {
    return 'bars'
  }
}

/** Gastos do período quebrados por categoria, forma de pagamento ou banco, em barras ou rosca. */
export default function BreakdownChart({ year, transactions, fixedExpenses, cards, month, kind }: Props) {
  const { colorOf } = useCategories()
  const [period, setPeriod] = useState<Period>(month ?? 'year')
  useEffect(() => setPeriod(month ?? 'year'), [month])
  const [dim, setDim] = useState<Dimension>(kind === 'category' ? 'category' : 'method')
  const [view, setViewState] = useState<View>(readView)
  const [includeFixed, setIncludeFixed] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  function setView(v: View) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // sem armazenamento: vale só nesta sessão
    }
  }

  const activeFixed = useMemo(() => fixedExpenses.filter((f) => f.active), [fixedExpenses])
  const periodTx = useMemo(
    () => (period === 'year' ? transactions : transactions.filter((t) => t.month === period)),
    [transactions, period],
  )

  const txKey = (t: Transaction) =>
    dim === 'category' ? t.category || NO_CATEGORY : dim === 'method' ? methodName(t.method) : t.bank || NO_BANK
  const fixedKey = (f: FixedExpense) =>
    dim === 'category'
      ? f.category || FIXED_NO_CATEGORY
      : dim === 'method'
        ? methodName(f.method)
        : f.bank || cards.find((c) => c.id === f.card_id)?.bank || NO_BANK

  const data = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of periodTx) map.set(txKey(t), (map.get(txKey(t)) ?? 0) + spent(t))
    if (includeFixed) {
      for (const f of activeFixed) {
        const amt = fixedAmountForPeriod(f, year, period)
        if (amt > 0) map.set(fixedKey(f), (map.get(fixedKey(f)) ?? 0) + amt)
      }
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTx, activeFixed, includeFixed, period, year, dim, cards])

  // bancos: cor pela ordem alfabética (sem duas cores iguais até 10 bancos)
  const bankColors = useMemo(() => {
    const names = data.map((d) => d.name).filter((n) => n !== NO_BANK).sort()
    return new Map(names.map((n, i) => [n, PALETTE[i % PALETTE.length]]))
  }, [data])

  const colorFor = (name: string) => {
    if (dim === 'category') return colorOf(name)
    if (dim === 'method') {
      const m = METHOD_BY_LABEL.get(name)
      return m ? METHOD_COLOR[m] : NEUTRAL
    }
    return name === NO_BANK ? NEUTRAL : bankColors.get(name) ?? NEUTRAL
  }

  const active = selected != null && data.some((d) => d.name === selected) ? selected : null
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = data[0]?.value ?? 0

  const detailRows = useMemo(() => {
    if (!active) return null
    const fixedRows = includeFixed
      ? activeFixed
          .filter((f) => fixedKey(f) === active)
          .map((f) => ({ f, amount: fixedAmountForPeriod(f, year, period) }))
          .filter((r) => r.amount > 0)
          .map(({ f, amount }) => ({
            key: f.id,
            label: f.name,
            meta: period === 'year' ? `fixo · ${fixedMonthsInYear(f, year)}x no ano` : 'fixo · este mês',
            amount,
            method: f.method,
            category: f.category,
          }))
      : []
    const txRows = periodTx
      .filter((t) => txKey(t) === active)
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
      .map((t) => ({
        key: t.id,
        label: t.description,
        meta: `${MONTHS_SHORT[t.month - 1]} · ${formatDate(t.occurred_on)}`,
        amount: spent(t),
        method: t.method,
        category: t.category,
      }))
    return [...fixedRows, ...txRows]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, periodTx, activeFixed, includeFixed, period, year, dim, cards])

  const toggle = (name: string) => setSelected((cur) => (cur === name ? null : name))
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const title =
    dim === 'category' ? 'Gastos por categoria' : dim === 'method' ? 'Gastos por forma de pagamento' : 'Gastos por banco'

  const marker = (name: string, size = 'h-3.5 w-3.5') =>
    dim === 'category' ? (
      <CategoryGlyph category={name} className={size} />
    ) : (
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(name) }} />
    )

  const seg = (opts: Array<[string, string]>, value: string, onPick: (v: string) => void) => (
    <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onPick(v)}
          className={`rounded-md px-2.5 py-1 transition ${value === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <span className="text-sm font-semibold tabular-nums text-slate-300">{formatBRL(total)}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PeriodPicker year={year} period={period} onChange={setPeriod} />
        {kind === 'payment' &&
          seg(
            [
              ['method', 'Forma'],
              ['bank', 'Banco'],
            ],
            dim,
            (v) => {
              setDim(v as Dimension)
              setSelected(null)
            },
          )}
        {seg(
          [
            ['bars', 'Barras'],
            ['donut', 'Rosca'],
          ],
          view,
          (v) => setView(v as View),
        )}
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-emerald-500"
            checked={includeFixed}
            onChange={(e) => setIncludeFixed(e.target.checked)}
          />
          incluir fixos
        </label>
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
        <p className="py-3 text-xs text-slate-400">Sem gastos neste período.</p>
      ) : view === 'bars' ? (
        <ul className="space-y-1.5" aria-label={title}>
          {data.map((d) => (
            <li key={d.name}>
              <button
                onClick={() => toggle(d.name)}
                className={`w-full rounded-md px-1.5 py-1 text-left text-sm transition ${
                  active === d.name ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                } ${active && active !== d.name ? 'opacity-50' : ''}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {marker(d.name)}
                    <span className="truncate text-slate-200">{d.name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-300">
                    {pct(d.value)}% · {formatBRL(d.value)}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${max > 0 ? Math.max(1, (d.value / max) * 100) : 0}%`, background: colorFor(d.name) }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-52 w-52 shrink-0" role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${pct(d.value)}%`).join(', ')}`}>
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
                    <Cell key={d.name} fill={colorFor(d.name)} opacity={active && active !== d.name ? 0.25 : 1} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={TOOLTIP_LABEL}
                  itemStyle={TOOLTIP_ITEM}
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
                    {marker(d.name)}
                    <span className="truncate text-slate-200">{d.name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-300">
                    {pct(d.value)}% · {formatBRL(d.value)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {dim !== 'method' && <MethodBadge method={r.method} />}
                      {dim !== 'category' && <CategoryTag category={r.category} />}
                      <span>{r.meta}</span>
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-slate-300">{formatBRL(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
