import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Transaction } from '../types'
import { COMMON_BANKS } from '../types'
import { useAuth } from '../lib/useAuth'
import { DEMO } from '../lib/demo'
import { useYearData } from '../lib/useYearData'
import { useSavings } from '../lib/useSavings'
import { useNotices } from '../lib/useNotices'
import { useCards } from '../lib/useCards'
import { formatBRL, todayISO } from '../lib/format'
import Header from './Header'
import StatCard from './StatCard'
import MonthCard from './MonthCard'
import MonthDetail from './MonthDetail'
import InstallmentModal from './InstallmentModal'
import BillsPanel from './BillsPanel'
import CategoryChart from './CategoryChart'
import BankChart from './BankChart'
import FixedExpensesPanel from './FixedExpensesPanel'
import SavingsPanel from './SavingsPanel'
import CardsPanel from './CardsPanel'
import CardModal from './CardModal'
import NewSavingsAccountModal from './NewSavingsAccountModal'
import SavingsDetailModal from './SavingsDetailModal'
import SummaryChart from './SummaryChart'
import PatrimonyCard from './PatrimonyCard'
import NoticeModal from './NoticeModal'
import MoneyInput from './MoneyInput'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'

export default function Dashboard() {
  const { user } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [view, setView] = useState<'month' | 'year'>('month')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [cardModal, setCardModal] = useState<{ card?: Card } | null>(null)
  const [installmentOpen, setInstallmentOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    danger?: boolean
    confirmLabel?: string
    onConfirm: () => void
  } | null>(null)
  const data = useYearData(DEMO ? 'demo' : user!.id, year)
  // lançamentos geram retiradas nas contas e consomem limite dos cartões: recarrega junto
  const savings = useSavings(DEMO ? 'demo' : user!.id, data.transactions)
  const cards = useCards(DEMO ? 'demo' : user!.id, data.transactions)
  const notices = useNotices(DEMO ? 'demo' : user!.id)
  const [newSavingsOpen, setNewSavingsOpen] = useState(false)
  const [openSavingsAccountId, setOpenSavingsAccountId] = useState<string | null>(null)
  const openSavingsAccount = openSavingsAccountId
    ? savings.accounts.find((a) => a.id === openSavingsAccountId) ?? null
    : null

  const knownBanks = useMemo(() => {
    const set = new Set(COMMON_BANKS)
    for (const t of data.transactions) if (t.bank) set.add(t.bank)
    for (const c of cards.cards) if (c.bank) set.add(c.bank)
    return [...set].sort()
  }, [data.transactions, cards.cards])

  const thisYear = new Date().getFullYear()
  const thisMonth = new Date().getMonth() + 1
  const currentMonth = thisYear === year ? thisMonth : null
  // Painel "Contas a pagar": mostra até o mês corrente (ano atual), o ano todo
  // (anos passados) ou nada (anos futuros). Parcelas de meses à frente ficam de fora.
  const billsThroughMonth = year < thisYear ? 12 : year > thisYear ? 0 : thisMonth
  // Gastos fixos "a pagar" no painel: só o mês corrente (ano atual) ou todos (anos passados)
  const fixedMonths =
    year < thisYear
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : year > thisYear
        ? []
        : [thisMonth]

  const selected = data.summaries.find((s) => s.month === month) ?? null

  function navigateMonth(delta: -1 | 1) {
    const m = month + delta
    if (m < 1) {
      setYear(year - 1)
      setMonth(12)
    } else if (m > 12) {
      setYear(year + 1)
      setMonth(1)
    } else setMonth(m)
  }

  const today = todayISO()
  const overdue = data.transactions.filter(
    (t) => !t.paid && t.due_date != null && t.due_date < today,
  )
  const overdueTotal = overdue.reduce((s, t) => s + Number(t.amount), 0)

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  function showToast(message: string, undo?: () => void) {
    window.clearTimeout(toastTimer.current)
    setToast({ message, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), 6000)
  }

  function handleDeleteTransaction(tx: Transaction) {
    if (tx.group_id) {
      const n = data.transactions.filter((x) => x.group_id === tx.group_id).length
      setConfirmState({
        title: 'Apagar parcelamento?',
        message: `"${tx.description}" faz parte de um parcelamento. Isso apaga todas as ${n} parcelas deste ano.`,
        danger: true,
        confirmLabel: 'Apagar todas',
        onConfirm: async () => {
          setConfirmState(null)
          await data.removeTransaction(tx.id, tx.group_id)
          showToast('Parcelamento removido.')
        },
      })
      return
    }
    void (async () => {
      await data.removeTransaction(tx.id)
      showToast('Lançamento excluído.', async () => {
        await data.restoreTransaction(tx)
        setToast(null)
      })
    })()
  }

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

        {overdue.length > 0 && (
          <a
            href="#contas-a-pagar"
            className="flex items-center justify-between gap-3 rounded-2xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-100 transition hover:bg-rose-950/60"
          >
            <span className="font-semibold">
              ⚠️ {overdue.length} {overdue.length === 1 ? 'conta atrasada' : 'contas atrasadas'} —{' '}
              {formatBRL(overdueTotal)}
            </span>
            <span className="shrink-0 text-xs text-rose-300 underline">ver contas</span>
          </a>
        )}

        {notices.notices.length > 0 && (
          <div className="space-y-2">
            {notices.notices.map((n) => (
              <div
                key={n.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-sky-800 bg-sky-950/40 px-4 py-3 text-sm text-sky-100"
              >
                <span className="font-medium">📌 {n.text}</span>
                <button
                  className="shrink-0 text-xs text-sky-300 hover:text-sky-100"
                  onClick={() => void notices.removeNotice(n.id)}
                  title="Remover aviso"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-sm font-semibold">
            {(
              [
                ['month', 'Mês'],
                ['year', 'Ano'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-4 py-1 transition ${
                  view === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-3 py-1.5" onClick={() => setNoticeOpen(true)}>
              + Aviso
            </button>
            <button className="btn-ghost px-3 py-1.5" onClick={() => setInstallmentOpen(true)}>
              + Parcelamento
            </button>
          </div>
        </div>

        {view === 'month' && selected && (
          <MonthDetail
            key={`${year}-${month}`}
            year={year}
            summary={selected}
            transactions={data.transactions}
            fixedExpenses={data.fixedExpenses}
            hasSalaryOverride={data.salaries.some((s) => s.month === selected.month)}
            knownBanks={knownBanks}
            cards={cards.cards}
            availableOf={cards.availableOf}
            savingsAccounts={savings.accounts}
            balanceOf={savings.balanceOf}
            isFixedPaid={data.isFixedPaid}
            onNavigate={navigateMonth}
            onCreateCard={cards.addCard}
            onSetMonthSalary={data.setMonthSalary}
            onSetFixedPaid={data.setFixedPaid}
            onAddTransaction={data.addTransaction}
            onAddInstallments={data.addInstallments}
            onInstallmentsAdded={(message) => showToast(message)}
            onSetPaid={data.setPaid}
            onPostpone={data.postponeTransaction}
            onUpdateTransaction={data.updateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {view === 'year' && (
        <>
        <PatrimonyCard
          year={year}
          contas={savings.patrimonyTotals.contas}
          caixinhas={savings.patrimonyTotals.caixinhas}
          investimentos={savings.patrimonyTotals.investimentos}
          remaining={data.annual.remaining}
        />

        {/* Resumo anual */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <div className="card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Alerta de sobra baixa
            </p>
            <MoneyInput
              value={data.lowBalanceAlert}
              onCommit={(v) => void data.setLowBalanceAlert(v)}
              className="mt-2"
              ariaLabel="Alerta de sobra baixa"
            />
            <p className="mt-1 text-[11px] text-slate-500">Sobra fica amarela abaixo desse valor</p>
          </div>
        </section>

        <h2 className="text-sm font-semibold text-slate-300">Meses de {year}</h2>

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
                lowBalanceAlert={data.lowBalanceAlert}
                onOpen={() => {
                  setMonth(s.month)
                  setView('month')
                  window.scrollTo({ top: 0 })
                }}
              />
            ))}
          </section>
        )}

        <BillsPanel
          year={year}
          throughMonth={billsThroughMonth}
          fixedMonths={fixedMonths}
          transactions={data.transactions}
          fixedExpenses={data.fixedExpenses}
          isFixedPaid={data.isFixedPaid}
          onSetPaid={data.setPaid}
          onSetFixedPaid={data.setFixedPaid}
          onPostpone={data.postponeTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />

        <CategoryChart year={year} transactions={data.transactions} fixedExpenses={data.fixedExpenses} />

        <BankChart year={year} transactions={data.transactions} />

        <SummaryChart summaries={data.summaries} />

        <SavingsPanel
          accounts={savings.accounts}
          balanceOf={savings.balanceOf}
          yieldOf={savings.yieldOf}
          cdiRate={savings.cdiRate}
          onSetCdiRate={(v) => void savings.setCdiRate(v)}
          totals={savings.totals}
          loading={savings.loading}
          onNew={() => setNewSavingsOpen(true)}
          onOpen={(a) => setOpenSavingsAccountId(a.id)}
        />

        <CardsPanel
          cards={cards.cards}
          loading={cards.loading}
          usedOf={cards.usedOf}
          availableOf={cards.availableOf}
          onNew={() => setCardModal({})}
          onEdit={(card) => setCardModal({ card })}
        />

        <FixedExpensesPanel
          items={data.fixedExpenses}
          knownBanks={knownBanks}
          onAdd={data.addFixed}
          onUpdate={data.updateFixed}
          onRemove={data.removeFixed}
        />
        </>
        )}
      </main>

      {noticeOpen && (
        <NoticeModal onClose={() => setNoticeOpen(false)} onAdd={notices.addNotice} />
      )}

      {installmentOpen && (
        <InstallmentModal
          year={year}
          knownBanks={knownBanks}
          cards={cards.cards}
          onClose={() => setInstallmentOpen(false)}
          onAdd={data.addInstallments}
          onAdded={(message) => showToast(message)}
        />
      )}

      {cardModal && (
        <CardModal
          card={cardModal.card}
          knownBanks={knownBanks}
          onClose={() => setCardModal(null)}
          onSave={(c) =>
            cardModal.card ? cards.updateCard(cardModal.card.id, c) : cards.addCard(c)
          }
          onRemove={
            cardModal.card
              ? () => {
                  const target = cardModal.card!
                  setCardModal(null)
                  setConfirmState({
                    title: 'Excluir cartão?',
                    message: `"${target.name}" será removido. Os lançamentos feitos nele continuam, só perdem o vínculo com o cartão.`,
                    danger: true,
                    confirmLabel: 'Excluir',
                    onConfirm: async () => {
                      setConfirmState(null)
                      await cards.removeCard(target.id)
                      await data.reload()
                    },
                  })
                }
              : undefined
          }
        />
      )}

      {newSavingsOpen && (
        <NewSavingsAccountModal
          knownBanks={knownBanks}
          onClose={() => setNewSavingsOpen(false)}
          onCreate={savings.addAccount}
        />
      )}

      {openSavingsAccount && (
        <SavingsDetailModal
          account={openSavingsAccount}
          movements={savings.movements.filter((m) => m.account_id === openSavingsAccount.id)}
          balance={savings.balanceOf(openSavingsAccount.id)}
          yielded={savings.yieldOf(openSavingsAccount.id)}
          cdiRate={savings.cdiRate}
          onSetCdiPercent={savings.setCdiPercent}
          onClose={() => setOpenSavingsAccountId(null)}
          onAddMovement={savings.addMovement}
          onRemoveMovement={savings.removeMovement}
          onRemoveAccount={savings.removeAccount}
          onSetIncludeInPatrimony={savings.setIncludeInPatrimony}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          actionLabel={toast.undo ? 'Desfazer' : undefined}
          onAction={toast.undo}
          onClose={() => setToast(null)}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-[11px] text-slate-600">
        Dados isolados por conta via Supabase Row Level Security.
      </footer>
    </div>
  )
}
