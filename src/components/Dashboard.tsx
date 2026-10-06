import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, FixedExpense, Transaction } from '../types'
import { COMMON_BANKS } from '../types'
import { useAuth } from '../lib/useAuth'
import { DEMO } from '../lib/demo'
import { useYearData } from '../lib/useYearData'
import { useSavings } from '../lib/useSavings'
import { useShares } from '../lib/useShares'
import { applySplit, groupTransactions, setSharePaid } from '../lib/shares'
import type { SplitPerson } from '../lib/shares'
import { useNotices } from '../lib/useNotices'
import { useCards } from '../lib/useCards'
import { useBudgets } from '../lib/useBudgets'
import { useRecurring } from '../lib/useRecurring'
import { useCommitments } from '../lib/useCommitments'
import { useRules } from '../lib/useRules'
import { useInstallments } from '../lib/useInstallments'
import { fixedAppliesToMonth } from '../lib/fixedExpense'
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
import SplitModal from './SplitModal'
import SharesPanel from './SharesPanel'
import InstallmentModal from './InstallmentModal'
import BillsPanel from './BillsPanel'
import IncomesBlock from './IncomesBlock'
import IncomeTemplatesPanel from './IncomeTemplatesPanel'
import CashflowCard from './CashflowCard'
import { computeCashflow } from '../lib/cashflow'
import { useCashflowSources } from '../lib/useCashflow'
import { monthIncomeItems, type IncomeItem } from '../lib/incomes'
import ImportStatementModal from './ImportStatementModal'
import PayBoletoModal from './PayBoletoModal'
import { findDebitAccount } from '../lib/cards'
import ReorganizeCardModal, { findMisplaced } from './ReorganizeCardModal'
import MonthComparison from './MonthComparison'
import InstallmentsPanel from './InstallmentsPanel'
import EmergencyCard from './EmergencyCard'
import RulesPanel from './RulesPanel'
import FixedExpensesPanel from './FixedExpensesPanel'
import SavingsPanel from './SavingsPanel'
import CardsPanel from './CardsPanel'
import CardModal from './CardModal'
import InvoicesPanel from './InvoicesPanel'
import PayInvoiceModal from './PayInvoiceModal'
import BudgetsPanel from './BudgetsPanel'
// gráficos (recharts) carregam sob demanda: a primeira tela abre mais rápido
const CategoryChart = lazy(() => import('./CategoryChart'))
const BankChart = lazy(() => import('./BankChart'))
const SummaryChart = lazy(() => import('./SummaryChart'))
const CommitmentChart = lazy(() => import('./CommitmentChart'))
import RecurringPanel from './RecurringPanel'
import RecurringBlock from './RecurringBlock'
import SearchPanel from './SearchPanel'
import TransferModal from './TransferModal'
import NewSavingsAccountModal from './NewSavingsAccountModal'
import SavingsDetailModal from './SavingsDetailModal'
import PatrimonyCard from './PatrimonyCard'
import NoticeModal from './NoticeModal'
import MoneyInput from './MoneyInput'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'

export default function Dashboard() {
  const { user } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [view, setView] = useState<'month' | 'year' | 'search' | 'config'>('month')
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [cardModal, setCardModal] = useState<{ card?: Card } | null>(null)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [boletoTarget, setBoletoTarget] = useState<
    { kind: 'tx'; tx: Transaction } | { kind: 'fixed'; f: FixedExpense; month: number } | null
  >(null)
  const [reorganizeOpen, setReorganizeOpen] = useState(false)
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
  const shares = useShares(DEMO ? 'demo' : user!.id, data.transactions)
  const [splitTarget, setSplitTarget] = useState<Transaction | null>(null)
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
  // faturas pagas que vencem no mês em tela, pra poder desfazer um pagamento feito sem querer
  const paidInvoices = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    const paidTx = data.transactions.filter((t) => t.card_id && t.paid)
    return buildInvoices(cards.cards, paidTx, cards.paidFixedList, new Date())
      .filter((i) => i.dueDate.startsWith(prefix))
      .reverse()
  }, [cards.cards, cards.paidFixedList, data.transactions, year, month])
  useDueReminders(remindersOn, data.transactions, invoices)
  const misplaced = useMemo(() => findMisplaced(cards.pendingTx, cards.cards), [cards.pendingTx, cards.cards])
  const cardsOverLimit = cards.cards.filter((c) => {
    const limit = Number(c.credit_limit)
    return limit > 0 && (cards.usedOf(c.id) / limit) * 100 >= cards.alertPct
  })
  const notices = useNotices(DEMO ? 'demo' : user!.id)
  const cashSources = useCashflowSources(DEMO ? 'demo' : user!.id, [
    data.transactions,
    data.extraIncomes,
    data.fixedStatus,
  ])
  const rules = useRules(DEMO ? 'demo' : user!.id)
  const plans = useInstallments(DEMO ? 'demo' : user!.id, [data.transactions])
  // atalho "Novo lançamento" do celular (/?novo=1): abre no mês atual com o campo em foco
  const [focusForm] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('novo'),
  )
  useEffect(() => {
    if (focusForm) window.history.replaceState(null, '', window.location.pathname)
  }, [focusForm])
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
  const cashflow = useMemo(
    () =>
      computeCashflow({
        year,
        month,
        now: new Date(),
        accounts: savings.accounts,
        movements: savings.movements,
        unpaidTx: cashSources.unpaidTx,
        incomeRows: cashSources.incomeRows,
        templates: data.incomeTemplates,
        fixedExpenses: data.fixedExpenses,
        paidFixedNow: cashSources.paidFixedNow,
      }),
    [
      year,
      month,
      savings.accounts,
      savings.movements,
      cashSources,
      data.incomeTemplates,
      data.fixedExpenses,
    ],
  )

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

  type TxPatch = Parameters<typeof data.updateTransaction>[1]
  type FixedPatch = Parameters<typeof data.updateFixed>[1]

  /** Guarda os valores antigos dos campos alterados pra poder desfazer. */
  function snapshot(prev: object, patch: object): Record<string, unknown> {
    const old: Record<string, unknown> = {}
    for (const k of Object.keys(patch)) old[k] = (prev as Record<string, unknown>)[k]
    return old
  }

  async function updateTransactionUndo(id: string, patch: TxPatch) {
    const prev = data.transactions.find((t) => t.id === id)
    await data.updateTransaction(id, patch)
    if (!prev) return
    const old = snapshot(prev, patch) as TxPatch
    showToast('Lançamento atualizado.', async () => {
      await data.updateTransaction(id, old)
      setToast(null)
    })
  }

  async function setPaidUndo(id: string, paid: boolean) {
    await data.setPaid(id, paid)
    showToast(paid ? 'Marcado como pago.' : 'Marcado como a pagar.', async () => {
      await data.setPaid(id, !paid)
      setToast(null)
    })
  }

  async function setPaidManyUndo(ids: string[], paid: boolean) {
    // só mexe no que realmente muda, pra o "Desfazer" não alterar o que já estava assim
    const changed = data.transactions.filter((t) => ids.includes(t.id) && t.paid !== paid).map((t) => t.id)
    if (changed.length === 0) return
    await data.setPaidMany(changed, paid)
    showToast(
      `${changed.length} ${changed.length === 1 ? 'lançamento marcado' : 'lançamentos marcados'} como ${paid ? 'pagos' : 'a pagar'}.`,
      async () => {
        await data.setPaidMany(changed, !paid)
        setToast(null)
      },
    )
  }

  async function receiveIncome(item: IncomeItem, amount: number, accountId: string | null) {
    const today = todayISO()
    if (item.id) {
      await data.updateIncome(item.id, {
        received: true,
        received_on: today,
        amount,
        account_id: accountId,
      })
    } else {
      await data.addIncome(month, item.description, amount, {
        received: true,
        accountId,
        day: item.day,
        templateId: item.templateId,
      })
    }
    showToast(`${item.description}: ${formatBRL(amount)} recebido${accountId ? ' e somado na conta' : ''}.`)
  }

  async function unreceiveIncome(item: IncomeItem) {
    if (!item.id) return
    if (item.templateId) await data.removeIncome(item.id)
    else await data.updateIncome(item.id, { received: false, received_on: null })
  }

  async function updateFixedUndo(id: string, patch: FixedPatch) {
    const prev = data.fixedExpenses.find((f) => f.id === id)
    await data.updateFixed(id, patch)
    if (!prev) return
    const old = snapshot(prev, patch) as FixedPatch
    showToast('Gasto fixo atualizado.', async () => {
      await data.updateFixed(id, old)
      setToast(null)
    })
  }

  async function saveSplit(tx: Transaction, people: SplitPerson[], all: boolean) {
    const uid = DEMO ? 'demo' : user!.id
    const txs = all && tx.group_id ? await groupTransactions(uid, tx.group_id) : [tx]
    await applySplit(uid, txs, tx, people)
    await data.reload()
    showToast(people.length ? 'Divisão salva.' : 'Divisão removida.')
  }

  async function confirmBoleto(accountId: string | null, paidOn: string) {
    const target = boletoTarget
    if (!target) return
    if (target.kind === 'tx') {
      const tx = target.tx
      const prev = { paid: tx.paid, debit_account_id: tx.debit_account_id, paid_on: tx.paid_on }
      await data.updateTransaction(tx.id, { paid: true, debit_account_id: accountId, paid_on: paidOn })
      showToast(
        `Boleto "${tx.description}" pago${accountId ? ' e descontado da conta' : ''}.`,
        async () => {
          await data.updateTransaction(tx.id, prev)
          setToast(null)
        },
      )
    } else {
      const { f, month: m } = target
      await data.setFixedPaid(f.id, m, true, { accountId, paidOn })
      showToast(`Boleto "${f.name}" pago${accountId ? ' e descontado da conta' : ''}.`, async () => {
        await data.setFixedPaid(f.id, m, false)
        setToast(null)
      })
    }
  }

  async function handlePayInvoice(inv: Invoice, accountId: string | null) {
    const txIds = inv.txs.map((t) => t.id)
    const fixedIds = inv.fixed.map((f) => f.id)
    await data.setPaidMany(txIds, true)
    await cards.payFixed(fixedIds)
    let movementId: string | null = null
    if (accountId) {
      movementId = await savings.addMovement({
        account_id: accountId,
        amount: inv.total,
        kind: 'retirada',
        occurred_on: todayISO(),
        note: `Fatura ${inv.card.name} (vence ${formatDate(inv.dueDate)})`,
      })
    }
    await data.reload()
    await cards.reload()
    showToast(`Fatura de ${inv.card.name} paga: ${formatBRL(inv.total)}.`, async () => {
      await data.setPaidMany(txIds, false)
      await cards.payFixed(fixedIds, false)
      if (movementId) await savings.removeMovement(movementId)
      await data.reload()
      await cards.reload()
      setToast(null)
    })
  }

  /** Volta uma fatura paga pra "a pagar" e devolve à conta o valor que saiu quando ela foi paga. */
  function handleUnpayInvoice(inv: Invoice) {
    const note = `Fatura ${inv.card.name} (vence ${formatDate(inv.dueDate)})`
    const moves = savings.movements.filter((m) => m.kind === 'retirada' && m.note === note)
    const refund = moves.reduce((s, m) => s + Number(m.amount), 0)
    setConfirmState({
      title: 'Desfazer pagamento da fatura?',
      message: `A fatura de ${inv.card.name} (${formatBRL(inv.total)}) volta para "a pagar".${
        moves.length > 0
          ? ` ${formatBRL(refund)} voltam para o saldo da conta de onde saiu.`
          : ' Não achei uma retirada de conta ligada a ela, então nenhum saldo muda.'
      }`,
      confirmLabel: 'Desfazer pagamento',
      danger: false,
      onConfirm: async () => {
        setConfirmState(null)
        await data.setPaidMany(inv.txs.map((t) => t.id), false)
        await cards.payFixed(inv.fixed.map((f) => f.id), false)
        for (const m of moves) await savings.removeMovement(m.id)
        await data.reload()
        await cards.reload()
        showToast(`Pagamento da fatura de ${inv.card.name} desfeito.`)
      },
    })
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

  const chartFallback = <div className="card h-64 animate-pulse bg-slate-900/40" />
  const fixedNow = data.fixedExpenses
    .filter((f) => fixedAppliesToMonth(f, thisYear, thisMonth))
    .reduce((s, f) => s + Number(f.amount), 0)

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
    <Suspense fallback={chartFallback}>
        <CategoryChart
          year={year}
          transactions={data.transactions}
          fixedExpenses={data.fixedExpenses}
          month={view === 'month' ? month : null}
        />

        <BankChart
          year={year}
          transactions={data.transactions}
          fixedExpenses={data.fixedExpenses.filter((f) => f.active)}
          cards={cards.cards}
          month={view === 'month' ? month : null}
        />

        <SummaryChart summaries={data.summaries} />
    </Suspense>
  )
  const installmentsEl = <InstallmentsPanel plans={plans} cards={cards.cards} />
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
          paidInvoices={paidInvoices}
          onUnpay={handleUnpayInvoice}
          hasCards={cards.cards.length > 0}
          onPay={(inv) => setPayInvoice(inv)}
          onImport={() => setImportOpen(true)}
          misplacedCount={misplaced.length}
          onReorganize={() => setReorganizeOpen(true)}
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
            onClick={(e) => {
              // "Contas a pagar" só existe na aba Ano: vai pra ela e rola até o painel
              e.preventDefault()
              setView('year')
              window.setTimeout(
                () => document.getElementById('contas-a-pagar')?.scrollIntoView({ block: 'start' }),
                150,
              )
            }}
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
                ['config', 'Configurar'],
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
            sharesByTx={shares.byTx}
            onSplit={setSplitTarget}
            onAddTransaction={data.addTransaction}
            onAddInstallments={data.addInstallments}
            onInstallmentsAdded={(message) => showToast(message)}
            onSetPaid={setPaidUndo}
            onSetPaidMany={setPaidManyUndo}
            onPayBoleto={(tx) => setBoletoTarget({ kind: 'tx', tx })}
            onPayFixedBoleto={(f) => setBoletoTarget({ kind: 'fixed', f, month })}
            onPostpone={data.postponeTransaction}
            onUpdateTransaction={updateTransactionUndo}
            onDeleteTransaction={handleDeleteTransaction}
            loadMonth={data.loadMonthTransactions}
            onCopyTransactions={data.copyTransactions}
            onCopied={(n) => showToast(`${n} lançamentos copiados do mês anterior.`)}
            onAddFixed={data.addFixed}
            onUpdateFixed={updateFixedUndo}
            rules={rules.rules}
            onSaveRule={rules.save}
            autoFocusForm={focusForm}
            onAddRecurring={recurring.add}
            onNotify={(message) => showToast(message)}
            usingIncomeTemplates={data.usingIncomeTemplates}
          >
            <CashflowCard
              year={year}
              month={month}
              flow={cashflow}
              hasAccounts={savings.accounts.some((a) => a.kind === 'conta')}
            />
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
            <IncomesBlock
              items={monthIncomeItems(data.incomeTemplates, data.extraIncomes, year, month)}
              accounts={savings.accounts}
              onReceive={(item, amount, accountId) => receiveIncome(item, amount, accountId)}
              onUnreceive={unreceiveIncome}
              onSkip={async (item) => {
                // "pular": vira uma linha de valor 0 neste mês (a receita fixa continua nos outros)
                if (item.id) {
                  await data.updateIncome(item.id, { amount: 0, received: true, received_on: todayISO() })
                } else {
                  await data.addIncome(month, item.description, 0, {
                    received: true,
                    templateId: item.templateId,
                  })
                }
              }}
              onRemove={async (item) => {
                if (item.id) await data.removeIncome(item.id)
              }}
              onDeleteTemplate={async (item) => {
                if (!item.templateId) return
                await data.removeTemplate(item.templateId)
                showToast(`Receita fixa "${item.description}" excluída.`)
              }}
              onEdit={async (item, v, scope) => {
                if (scope === 'all' && item.templateId) {
                  await data.updateTemplate(item.templateId, {
                    name: v.description,
                    amount: v.amount,
                    day: v.day,
                    account_id: v.accountId,
                  })
                  showToast('Receita fixa atualizada em todos os meses.')
                } else if (item.id) {
                  await data.updateIncome(item.id, {
                    description: v.description,
                    amount: v.amount,
                    day: v.day,
                    account_id: v.accountId,
                    ...(item.received && v.receivedOn ? { received_on: v.receivedOn } : {}),
                  })
                } else {
                  // previsto de uma receita fixa: vira uma linha só deste mês, com os valores editados
                  await data.addIncome(month, v.description, v.amount, {
                    received: false,
                    accountId: v.accountId,
                    day: v.day,
                    templateId: item.templateId,
                  })
                }
              }}
              onAdd={async (description, amount, opts) => {
                if (opts.repeat) {
                  const tpl = await data.addTemplate({
                    name: description,
                    amount,
                    day: opts.day,
                    account_id: opts.accountId,
                    active: true,
                    start_year: year,
                    start_month: month,
                  })
                  if (opts.received) {
                    await data.addIncome(month, description, amount, {
                      received: true,
                      accountId: opts.accountId,
                      day: opts.day,
                      templateId: tpl.id,
                    })
                  }
                } else {
                  await data.addIncome(month, description, amount, {
                    received: opts.received,
                    accountId: opts.accountId,
                    day: opts.day,
                  })
                }
              }}
            />
            <MonthComparison
              year={year}
              month={month}
              transactions={data.transactions}
              fixedExpenses={data.fixedExpenses}
              loadMonth={data.loadMonthTransactions}
            />
          </MonthDetail>
        )}

        {view === 'month' && (
          <>
            <SharesPanel
              shares={shares.shares}
              accounts={savings.accounts.filter((a) => a.kind === 'conta')}
              onSetPaid={async (s, paid, accountId) => {
                await setSharePaid(DEMO ? 'demo' : user!.id, s, paid, accountId, todayISO())
                await shares.reload()
                await savings.reload()
                showToast(paid ? `${s.person_name} pagou ${formatBRL(Number(s.amount))}.` : 'Pagamento desmarcado.')
              }}
            />
            {invoicesEl}
            {installmentsEl}
            {cardsEl}
            {chartsEl}
          </>
        )}

        {view === 'config' && (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              {data.usingIncomeTemplates
                ? 'Em desuso: você tem receitas fixas cadastradas.'
                : `Fixos: ${formatBRL(data.annual.fixedMonthly)}/mês`}
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

            {cardsEl}

        <FixedExpensesPanel
          items={data.fixedExpenses}
          cards={cards.cards}
          accounts={savings.accounts}
          knownBanks={knownBanks}
          onAdd={data.addFixed}
          onUpdate={updateFixedUndo}
          onRemove={data.removeFixed}
        />

        <IncomeTemplatesPanel
          templates={data.incomeTemplates}
          accounts={savings.accounts}
          onAdd={data.addTemplate}
          onUpdate={data.updateTemplate}
          onRemove={data.removeTemplate}
        />

        <RecurringPanel
          items={recurring.items}
          cards={cards.cards}
          knownBanks={knownBanks}
          onAdd={recurring.add}
          onUpdate={recurring.update}
          onRemove={recurring.remove}
        />

        <RulesPanel
          rules={rules.rules}
          knownBanks={knownBanks}
          onSave={rules.save}
          onRemove={rules.remove}
        />
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
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label={`Renda ${year}`}
            value={data.annual.salary}
            tone="neutral"
            hint={data.annual.extra > 0 ? `inclui ${formatBRL(data.annual.extra)} extras` : undefined}
          />
          <StatCard label="Gasto no ano" value={data.annual.spent} tone="rose" />
          <StatCard
            label="Sobra no ano"
            value={data.annual.remaining}
            tone="auto"
            hint={data.annual.remaining >= 0 ? 'no azul 🎉' : 'no vermelho'}
          />
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
          onSetPaid={setPaidUndo}
          onPayBoleto={(tx) => setBoletoTarget({ kind: 'tx', tx })}
          onPayFixedBoleto={(f, m) => setBoletoTarget({ kind: 'fixed', f, month: m })}
          onSetFixedPaid={data.setFixedPaid}
          onPostpone={data.postponeTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />

        {chartsEl}

        <Suspense fallback={chartFallback}>
          <CommitmentChart
            rows={commitments}
            fixedExpenses={data.fixedExpenses}
            defaultSalary={data.defaultSalary}
          />
        </Suspense>

        <EmergencyCard
          saved={savings.patrimonyTotals.caixinhas}
          fixedMonthly={fixedNow}
          targetMonths={savings.emergencyMonths}
          onSetTarget={(m) => void savings.setEmergencyMonths(m)}
        />

        {invoicesEl}

        {installmentsEl}

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

      {reorganizeOpen && (
        <ReorganizeCardModal
          items={misplaced}
          onClose={() => setReorganizeOpen(false)}
          onMove={async (moves) => {
            const back = moves.map((mv) => {
              const t = misplaced.find((i) => i.tx.id === mv.id)!.tx
              return { id: mv.id, year: t.year, month: t.month }
            })
            await data.moveTransactions(moves)
            showToast(
              `${moves.length} ${moves.length === 1 ? 'lançamento movido' : 'lançamentos movidos'} pro mês da fatura.`, async () => {
              await data.moveTransactions(back)
              setToast(null)
            })
          }}
        />
      )}

      {splitTarget && (
        <SplitModal
          tx={splitTarget}
          shares={shares.byTx.get(splitTarget.id) ?? []}
          knownPeople={shares.people}
          onClose={() => setSplitTarget(null)}
          onSave={(people, all) => saveSplit(splitTarget, people, all)}
        />
      )}

      {boletoTarget && (
        <PayBoletoModal
          title={boletoTarget.kind === 'tx' ? boletoTarget.tx.description : boletoTarget.f.name}
          dueDate={boletoTarget.kind === 'tx' ? boletoTarget.tx.due_date : null}
          amount={Number(boletoTarget.kind === 'tx' ? boletoTarget.tx.amount : boletoTarget.f.amount)}
          accounts={savings.accounts.filter((a) => a.kind === 'conta')}
          balanceOf={savings.balanceOf}
          defaultAccountId={
            (boletoTarget.kind === 'fixed' ? boletoTarget.f.account_id : null) ??
            findDebitAccount(
              savings.accounts,
              boletoTarget.kind === 'tx' ? boletoTarget.tx.bank : boletoTarget.f.bank,
              'boleto',
            )?.id ??
            null
          }
          onClose={() => setBoletoTarget(null)}
          onConfirm={confirmBoleto}
        />
      )}

      {importOpen && (
        <ImportStatementModal
          cards={cards.cards}
          rules={rules.rules}
          existing={data.transactions}
          onClose={() => setImportOpen(false)}
          onImport={data.importTransactions}
          onDone={(n, y, m) => {
            // leva você pro mês da compra mais recente do arquivo
            setYear(y)
            setMonth(m)
            setView('month')
            window.scrollTo({ top: 0 })
            showToast(`${n} lançamentos importados (abrindo ${m.toString().padStart(2, '0')}/${y}).`)
          }}
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
