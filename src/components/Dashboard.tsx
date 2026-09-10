import { useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { DEMO } from '../lib/demo'
import { useYearData } from '../lib/useYearData'
import { formatBRL } from '../lib/format'
import Header from './Header'
import StatCard from './StatCard'
import MonthCard from './MonthCard'
import MonthDetail from './MonthDetail'
import InstallmentModal from './InstallmentModal'
import BillsPanel from './BillsPanel'
import FixedExpensesPanel from './FixedExpensesPanel'
import SummaryChart from './SummaryChart'
import MoneyInput from './MoneyInput'

export default function Dashboard() {
  const { user } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [openMonth, setOpenMonth] = useState<number | null>(null)
  const [installmentOpen, setInstallmentOpen] = useState(false)
  const data = useYearData(DEMO ? 'demo' : user!.id, year)

  const currentMonth =
    new Date().getFullYear() === year ? new Date().getMonth() + 1 : null

  const selected =
    openMonth != null ? data.summaries.find((s) => s.month === openMonth) ?? null : null

  return (
    <div className="min-h-screen">
      <Header year={year} onYearChange={setYear} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {data.error && (
          <div className="card border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">
            <p className="font-semibold">Não consegui carregar os dados.</p>
            <p className="mt-1 text-rose-300/80">{data.error}</p>
            <p className="mt-2 text-xs text-rose-300/60">
              Verifique se você rodou o <code>supabase/schema.sql</code> e se as variáveis
              VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY estão corretas.
            </p>
          </div>
        )}

        {/* Resumo anual */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={`Salário ${year}`} value={data.annual.salary} tone="neutral" />
          <StatCard label="Gasto no ano" value={data.annual.spent} tone="rose" />
          <StatCard
            label="Sobra no ano"
            value={data.annual.remaining}
            tone="auto"
            hint={data.annual.remaining >= 0 ? 'no azul 🎉' : 'no vermelho'}
          />
          <div className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Salário padrão / mês
            </p>
            <MoneyInput
              value={data.defaultSalary}
              onCommit={(v) => void data.setDefaultSalary(v)}
              className="mt-2"
              ariaLabel="Salário padrão mensal"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Fixos: {formatBRL(data.annual.fixedMonthly)}/mês
            </p>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Meses de {year}</h2>
          <button className="btn-ghost px-3 py-1.5" onClick={() => setInstallmentOpen(true)}>
            + Parcelamento
          </button>
        </div>

        {data.loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card h-40 animate-pulse bg-slate-900/40" />
            ))}
          </div>
        ) : (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.summaries.map((s) => (
              <MonthCard
                key={s.month}
                summary={s}
                txCount={data.transactions.filter((t) => t.month === s.month).length}
                isCurrent={currentMonth === s.month}
                onOpen={() => setOpenMonth(s.month)}
              />
            ))}
          </section>
        )}

        <BillsPanel
          year={year}
          transactions={data.transactions}
          onSetPaid={data.setPaid}
          onRemove={data.removeTransaction}
        />

        <SummaryChart summaries={data.summaries} />

        <FixedExpensesPanel
          items={data.fixedExpenses}
          onAdd={data.addFixed}
          onUpdate={data.updateFixed}
          onRemove={data.removeFixed}
        />
      </main>

      {installmentOpen && (
        <InstallmentModal
          year={year}
          onClose={() => setInstallmentOpen(false)}
          onAdd={data.addInstallments}
        />
      )}

      {selected && (
        <MonthDetail
          year={year}
          summary={selected}
          transactions={data.transactions}
          hasSalaryOverride={data.salaries.some((s) => s.month === selected.month)}
          onClose={() => setOpenMonth(null)}
          onSetMonthSalary={data.setMonthSalary}
          onAddTransaction={data.addTransaction}
          onSetPaid={data.setPaid}
          onUpdateTransaction={data.updateTransaction}
          onRemoveTransaction={data.removeTransaction}
        />
      )}

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-[11px] text-slate-600">
        Dados isolados por conta via Supabase Row Level Security.
      </footer>
    </div>
  )
}
