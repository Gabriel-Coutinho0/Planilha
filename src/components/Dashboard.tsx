import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Transaction } from '../types'
import { COMMON_BANKS } from '../types'
import { useAuth } from '../lib/useAuth'
import { DEMO } from '../lib/demo'
import { useYearData } from '../lib/useYearData'
import { useSavings } from '../lib/useSavings'
import { useNotices } from '../lib/useNotices'
import { useCards } from '../lib/useCards'
import { useBudgets } from '../lib/useBudgets'
import { useRecurring } from '../lib/useRecurring'
import { useCommitments } from '../lib/useCommitments'
import { buildInvoices, type Invoice } from '../lib/invoices'
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
  remindersSupported,
  useDueReminders,
} from '../lib/reminders'
import { formatBRL, formatDate, todayISO } from '../lib/format'
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
import InvoicesPanel from './InvoicesPanel'
import PayInvoiceModal from './PayInvoiceModal'
import BudgetsPanel from './BudgetsPanel'
import CommitmentChart from './CommitmentChart'
import RecurringPanel from './RecurringPanel'
import RecurringBlock from './RecurringBlock'
import SearchPanel from './SearchPanel'
import TransferModal from './TransferModal'
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
  const [view, setView] = useState<'month' | 'year' | 'search'>('month')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [cardModal, setCardModal] = useState<{ card?: Card } | null>(null)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [remindersOn, setRemindersOn] = useState(remindersEnabled())
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
  const cards = useCards(DEMO ? 'demo' : user!.id, data.fixedExpenses, [
    data.transactions,
    data.fixedStatus,
  ])
  const budgets = useBudgets(DEMO ? 'demo' : user!.id)
  const recurring = useRecurring(DEMO ? 'demo' : user!.id)
  const commitments = useCommitments(DEMO ? 'demo' : user!.id, [data.transactions])
  const invoices = useMemo(
    () => buildInvoices(cards.cards, cards.pendingTx, cards.pendingFixed, new Date()),
    [cards.cards, cards.pendingTx, cards.pendingFixed],
  )
  useDueReminders(remindersOn, data.transactions, invoices)
  const cardsOverLimit = cards.cards.filter((c) => {
    const limit = Number(c.credit_limit)
    return limit > 0 && (cards.usedOf(c.id) / limit) * 100 >= cards.alertPct
  })
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

  async function toggleReminders() {
    if (remindersOn) {
      disableReminders()
      setRemindersOn(false)
      showToast('Lembretes desativados.')
      return
    }
    const ok = await enableReminders()
    setRemindersOn(ok)
    showToast(
      ok
        ? 'Lembretes ativados: aviso quando algo vencer amanhã ou hoje.'
        : 'Não consegui ativar: permita notificações nas configurações do navegador.',
    )
  }

  async function handlePayInvoice(inv: Invoice, accountId: string | null) {
    await data.setPaidMany(
      inv.txs.map((t) => t.id),
      true,
    )
    await cards.payFixed(inv.fixed.map((f) => f.id))
    if (accountId) {
      await savings.addMovement({
        account_id: accountId,
        amount: inv.total,
        kind: 'retirada',
        occurred_on: todayISO(),
        note: `Fatura ${inv.card.name} (vence ${formatDate(inv.dueDate)})`,
      })
    }
    await data.reload()
    await cards.reload()
    showToast(`Fatura de ${inv.card.name} paga: ${formatBRL(inv.total)}.`)
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

  const patrimonyEl = (
        <PatrimonyCard
          year={year}
          contas={savings.patrimonyTotals.contas}
          caixinhas={savings.patrimonyTotals.caixinhas}
          investimentos={savings.patrimonyTotals.investimentos}
          remaining={data.annual.remaining}
        />
  )
  const chartsEl = (
    <>
        <CategoryChart year={year} transactions={data.transactions} fixedExpenses={data.fixedExpenses} />

        <BankChart year={year} transactions={data.transactions} />

        <SummaryChart summaries={data.summaries} />
    </>
  )
  const savingsEl = (
        <SavingsPanel
          accounts={savings.accounts}
          balanceOf={savings.balanceOf}
          yieldOf={savings.yieldOf}
          cdiRate={savings.cdiRate}
          onSetCdiRate={(v) => void savings.setCdiRate(v)}
          totals={savings.totals}
          loading={savings.loading}
          onNew={() => setNewSavingsOpen(true)}
          onTransfer={() => setTransferOpen(true)}
          onOpen={(a) => setOpenSavingsAccountId(a.id)}
        />
  )
  const cardsEl = (
        <CardsPanel
          cards={cards.cards}
          loading={cards.loading}
          usedOf={cards.usedOf}
          availableOf={cards.availableOf}
          alertPct={cards.alertPct}
          onSetAlertPct={(v) => void cards.setAlertPct(v)}
          onNew={() => setCardModal({})}
          onEdit={(card) => setCardModal({ card })}
        />
  )
  const invoicesEl = (
        <InvoicesPanel
          invoices={invoices}
          hasCards={cards.cards.length > 0}
          onPay={(inv) => setPayInvoice(inv)}
        />
  )

  return (
    <div className="min-h-screen">
      <Header year={year} onYearChange={setYear} loading={data.loading} />

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

        {cardsOverLimit.map((c) => {
          const used = cards.usedOf(c.id)
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
            >
              <span className="font-semibold">
                💳 {c.name}: {Math.round((used / Number(c.credit_limit)) * 100)}% do limite usado
                (disponível {formatBRL(cards.availableOf(c))})
              </span>
            </div>
          )
        })}

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

        {patrimonyEl}

        {savingsEl}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-sm font-semibold">
            {(
              [
                ['month', 'Mês'],
                ['year', 'Ano'],
                ['search', 'Buscar'],
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
            {remindersSupported && (
              <button
                className={`btn-ghost px-3 py-1.5 ${remindersOn ? '!border-emerald-600 !text-emerald-300' : ''}`}
                onClick={() => void toggleReminders()}
                title="Notificação quando uma conta vencer amanhã ou hoje"
              >
                {remindersOn ? '🔔 Lembretes' : '🔕 Lembretes'}
              </button>
            )}
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
            loadMonth={data.loadMonthTransactions}
            onCopyTransactions={data.copyTransactions}
            onCopied={(n) => showToast(`${n} lançamentos copiados do mês anterior.`)}
            onAddFixed={data.addFixed}
            onUpdateFixed={data.updateFixed}
            onAddRecurring={recurring.add}
            onNotify={(message) => showToast(message)}
          >
            <RecurringBlock
              year={year}
              month={month}
              items={recurring.items}
              transactions={data.transactions}
              cards={cards.cards}
              onLaunch={data.addTransaction}
            />
            <BudgetsPanel
              year={year}
              month={month}
              transactions={data.transactions}
              fixedExpenses={data.fixedExpenses}
              budgets={budgets.budgets}
              onSetBudget={budgets.setBudget}
            />
          </MonthDetail>
        )}

        {view === 'month' && (
          <>
            {invoicesEl}
            {cardsEl}
            {chartsEl}
          </>
        )}

        {view === 'search' && (
          <SearchPanel
            year={year}
            transactions={data.transactions}
            cards={cards.cards}
            onOpenMonth={(m) => {
              setMonth(m)
              setView('month')
              window.scrollTo({ top: 0 })
            }}
          />
        )}

        {view === 'year' && (
        <>
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

        {chartsEl}

        <CommitmentChart
          rows={commitments}
          fixedExpenses={data.fixedExpenses}
          defaultSalary={data.defaultSalary}
        />

        {invoicesEl}

        {cardsEl}

        <FixedExpensesPanel
          items={data.fixedExpenses}
          cards={cards.cards}
          knownBanks={knownBanks}
          onAdd={data.addFixed}
          onUpdate={data.updateFixed}
          onRemove={data.removeFixed}
        />

        <RecurringPanel
          items={recurring.items}
          cards={cards.cards}
          knownBanks={knownBanks}
          onAdd={recurring.add}
          onUpdate={recurring.update}
          onRemove={recurring.remove}
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

      {payInvoice && (
        <PayInvoiceModal
          invoice={payInvoice}
          accounts={savings.accounts}
          balanceOf={savings.balanceOf}
          onClose={() => setPayInvoice(null)}
          onConfirm={(accountId) => handlePayInvoice(payInvoice, accountId)}
        />
      )}

      {transferOpen && (
        <TransferModal
          accounts={savings.accounts}
          balanceOf={savings.balanceOf}
          onClose={() => setTransferOpen(false)}
          onTransfer={savings.transfer}
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
          onSetGoal={savings.setGoal}
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
