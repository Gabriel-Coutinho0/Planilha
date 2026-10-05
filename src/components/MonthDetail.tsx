import { useMemo, useState, type FormEvent } from 'react'
import type {
  Card,
  FixedExpense,
  PaymentMethod,
  MonthSummary,
  SavingsAccount,
  Transaction,
} from '../types'
import { CATEGORIES, METHOD_LABEL } from '../types'
import { MONTHS, formatBRL, formatDate, parseAmount, todayISO } from '../lib/format'
import MoneyInput from './MoneyInput'
import MethodBadge from './MethodBadge'
import CategoryTag from './CategoryTag'
import BankTag from './BankTag'
import NoteText from './NoteText'
import { fixedAppliesToMonth } from '../lib/fixedExpense'
import { cardDueDate, findDebitAccount } from '../lib/cards'
import type { CardInput } from '../lib/useCards'
import CardModal from './CardModal'

interface Props {
  year: number
  summary: MonthSummary
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  hasSalaryOverride: boolean
  knownBanks: string[]
  cards: Card[]
  availableOf: (card: Card) => number
  savingsAccounts: SavingsAccount[]
  balanceOf: (accountId: string) => number
  isFixedPaid: (fixedExpenseId: string, month: number) => boolean
  /** Vai pro mês anterior (-1) ou seguinte (1). */
  onNavigate: (delta: -1 | 1) => void
  onCreateCard: (c: CardInput) => Promise<Card>
  onSetMonthSalary: (month: number, value: number) => Promise<void>
  onSetFixedPaid: (fixedExpenseId: string, month: number, paid: boolean) => Promise<void>
  onAddTransaction: (t: {
    month: number
    description: string
    amount: number
    occurred_on: string
    paid?: boolean
    due_date?: string | null
    method?: PaymentMethod | null
    category?: string | null
    bank?: string | null
    note?: string | null
    card_id?: string | null
    debit_account_id?: string | null
  }) => Promise<void>
  onAddInstallments: (p: {
    description: string
    count: number
    amount: number
    startYear: number
    startMonth: number
    day: number
    method?: PaymentMethod | null
    category?: string | null
    bank?: string | null
    note?: string | null
    cardId?: string | null
  }) => Promise<{ addedThisYear: number; addedNextYears: number }>
  onInstallmentsAdded?: (message: string) => void
  onSetPaid: (id: string, paid: boolean) => Promise<void>
  onPostpone: (id: string) => Promise<void>
  onUpdateTransaction: (
    id: string,
    patch: Partial<
      Pick<
        Transaction,
        | 'description'
        | 'amount'
        | 'occurred_on'
        | 'due_date'
        | 'method'
        | 'paid'
        | 'category'
        | 'bank'
        | 'note'
        | 'card_id'
        | 'debit_account_id'
      >
    >,
  ) => Promise<void>
  onDeleteTransaction: (tx: Transaction) => void
}

const METHOD_OPTIONS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

const NO_BANK = 'Sem banco'
const NO_CATEGORY = 'Sem categoria'

type GroupBy = 'bank' | 'category' | 'none'

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'bank', label: 'Banco' },
  { value: 'category', label: 'Categoria' },
  { value: 'none', label: 'Sem agrupar' },
]

export default function MonthDetail({
  year,
  summary,
  transactions,
  fixedExpenses,
  hasSalaryOverride,
  knownBanks,
  cards,
  availableOf,
  savingsAccounts,
  balanceOf,
  isFixedPaid,
  onNavigate,
  onCreateCard,
  onSetMonthSalary,
  onSetFixedPaid,
  onAddTransaction,
  onAddInstallments,
  onInstallmentsAdded,
  onSetPaid,
  onPostpone,
  onUpdateTransaction,
  onDeleteTransaction,
}: Props) {
  const { month } = summary
  const rows = useMemo(
    () => transactions.filter((t) => t.month === month),
    [transactions, month],
  )
  const activeFixed = useMemo(
    () => fixedExpenses.filter((f) => fixedAppliesToMonth(f, year, month)),
    [fixedExpenses, year, month],
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('bank')

  // Soma dos gastos fixos por banco/categoria, pra somar junto do grupo de
  // "Lançamentos e contas" (sem duplicar a linha — o fixo já aparece na
  // lista de cima, aqui só entra no total do grupo).
  const fixedKeyTotals = useMemo(() => {
    const map = new Map<string, number>()
    if (groupBy === 'none') return map
    for (const f of activeFixed) {
      const key = groupBy === 'bank' ? f.bank || NO_BANK : f.category || NO_CATEGORY
      map.set(key, (map.get(key) ?? 0) + Number(f.amount))
    }
    return map
  }, [activeFixed, groupBy])

  const groups = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, Transaction[]>()
    for (const t of rows) {
      const key = groupBy === 'bank' ? t.bank || NO_BANK : t.category || NO_CATEGORY
      const arr = map.get(key)
      if (arr) arr.push(t)
      else map.set(key, [t])
    }
    for (const key of fixedKeyTotals.keys()) {
      if (!map.has(key)) map.set(key, [])
    }
    return [...map.entries()]
      .map(([name, txs]) => ({
        name,
        txs,
        total: txs.reduce((s, t) => s + Number(t.amount), 0) + (fixedKeyTotals.get(name) ?? 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [rows, groupBy, fixedKeyTotals])

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate(year, month))
  const [due, setDue] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [category, setCategory] = useState('')
  const [bank, setBank] = useState('')
  const [cardId, setCardId] = useState('')
  const [debit, setDebit] = useState(true)
  const [note, setNote] = useState('')
  const [paid, setPaidState] = useState(true)
  const [installments, setInstallments] = useState(false)
  const [count, setCount] = useState(2)
  const [moreOpen, setMoreOpen] = useState(false)
  const [newCardOpen, setNewCardOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const card = cards.find((c) => c.id === cardId) ?? null
  const debitAccount = installments ? null : findDebitAccount(savingsAccounts, bank, method)

  function applyCard(c: Card, onDate: string) {
    setCardId(c.id)
    setBank(c.bank || c.name)
    setDue(cardDueDate(c, onDate))
    // compra no cartão fica "a pagar" até a fatura ser paga
    setPaidState(false)
  }

  function pickMethod(m: PaymentMethod | '') {
    setMethod(m)
    if (m === 'cartao') {
      setPaidState(false)
      if (!card && cards.length === 1) applyCard(cards[0], date)
    } else {
      if (cardId) setCardId('')
      setPaidState(true)
    }
  }

  function pickCard(id: string) {
    const c = cards.find((x) => x.id === id)
    if (c) applyCard(c, date)
    else setCardId('')
  }

  function pickDate(d: string) {
    setDate(d)
    if (card && d) setDue(cardDueDate(card, d))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0) return
    setBusy(true)
    const bankValue = method === 'cartao' && card ? card.bank || card.name : bank.trim() || null
    if (installments && count > 1) {
      let startYear = year
      let startMonth = month
      let day = Number(date.slice(8, 10)) || 1
      if (card) {
        // cada parcela vence no dia de vencimento do cartão, a partir da 1ª fatura
        const first = cardDueDate(card, date)
        startYear = Number(first.slice(0, 4))
        startMonth = Number(first.slice(5, 7))
        day = Number(first.slice(8, 10))
      }
      const res = await onAddInstallments({
        description: desc.trim() || 'Sem descrição',
        count,
        amount: v,
        startYear,
        startMonth,
        day,
        method: method || null,
        category: category || null,
        bank: bankValue,
        note: note.trim() || null,
        cardId: card?.id ?? null,
      })
      const extra = res.addedNextYears > 0 ? ` (${res.addedNextYears} em anos seguintes)` : ''
      onInstallmentsAdded?.(`${count} parcelas adicionadas${extra}.`)
    } else {
      await onAddTransaction({
        month,
        description: desc.trim() || 'Sem descrição',
        amount: v,
        occurred_on: date,
        paid,
        due_date: due || null,
        method: method || null,
        category: category || null,
        bank: bankValue,
        note: note.trim() || null,
        card_id: card?.id ?? null,
        debit_account_id: debitAccount && debit ? debitAccount.id : null,
      })
    }
    setDesc('')
    setAmount('')
    setDue('')
    setMethod('')
    setCategory('')
    setBank('')
    setCardId('')
    setDebit(true)
    setNote('')
    setPaidState(true)
    setInstallments(false)
    setCount(2)
    setBusy(false)
  }

  const positive = summary.remaining >= 0
  const today = todayISO()
  const cardName = (id: string | null) => (id ? cards.find((c) => c.id === id)?.name : undefined)
  const accountName = (id: string | null) =>
    id ? savingsAccounts.find((a) => a.id === id)?.name : undefined

  function renderTxRow(t: Transaction) {
    return editingId === t.id ? (
      <TransactionEditRow
        key={t.id}
        tx={t}
        knownBanks={knownBanks}
        cards={cards}
        savingsAccounts={savingsAccounts}
        onNewCard={() => setNewCardOpen(true)}
        onCancel={() => setEditingId(null)}
        onSave={async (patch) => {
          await onUpdateTransaction(t.id, patch)
          setEditingId(null)
        }}
      />
    ) : (
      <TransactionViewRow
        key={t.id}
        tx={t}
        today={today}
        cardName={cardName(t.card_id)}
        accountName={t.paid ? accountName(t.debit_account_id) : undefined}
        onTogglePaid={(v) => void onSetPaid(t.id, v)}
        onPostpone={() => void onPostpone(t.id)}
        onEdit={() => setEditingId(t.id)}
        onRemove={() => onDeleteTransaction(t)}
      />
    )
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost px-2.5 py-1"
            onClick={() => onNavigate(-1)}
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <h2 className="min-w-[9.5rem] text-center text-lg font-bold">
            {MONTHS[month - 1]} <span className="text-slate-500">{year}</span>
          </h2>
          <button
            className="btn-ghost px-2.5 py-1"
            onClick={() => onNavigate(1)}
            title="Próximo mês"
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
        <p className={`text-right text-sm font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          Sobra {formatBRL(summary.remaining)}
          {summary.pendingCount > 0 && (
            <span className="block text-xs text-amber-300">
              {formatBRL(summary.pendingTotal)} a pagar
            </span>
          )}
        </p>
      </div>

      <form onSubmit={handleAdd} className="mb-5 space-y-2 rounded-xl bg-slate-800/40 p-3">
        <div className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <input
            className="input col-span-2 sm:col-span-1"
            placeholder="Descrição (ex: mercado, conta de luz)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <input
            className="input"
            placeholder="Valor 0,00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Salvando…' : installments ? `Adicionar ${count}x` : 'Adicionar'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            className="input"
            value={method}
            onChange={(e) => pickMethod(e.target.value as PaymentMethod | '')}
          >
            <option value="">Forma…</option>
            {METHOD_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Categoria…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <BankOrCardField
            method={method}
            bank={bank}
            onBank={setBank}
            cardId={cardId}
            onCard={pickCard}
            cards={cards}
            knownBanks={knownBanks}
            listId="banks-add"
            onNewCard={() => setNewCardOpen(true)}
          />
        </div>
        {card && (
          <p className="text-[11px] text-slate-400">
            💳 {card.name}: disponível {formatBRL(availableOf(card))}
            {due && <> · fatura vence {formatDate(due)}</>}
          </p>
        )}
        {debitAccount && (
          <DebitCheck
            account={debitAccount}
            balance={balanceOf(debitAccount.id)}
            checked={debit}
            onChange={setDebit}
            willWaitPayment={!paid}
          />
        )}

        <button
          type="button"
          className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
          onClick={() => setMoreOpen((v) => !v)}
        >
          {moreOpen ? '▾ menos opções' : '▸ mais opções (data, vencimento, parcelar, observação)'}
        </button>
        {moreOpen && (
          <div className="space-y-2">
            <textarea
              className="input w-full resize-y"
              rows={2}
              placeholder="Observação (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                {installments ? '1ª parcela' : 'data'}
                <input
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => pickDate(e.target.value)}
                />
              </label>
              {!installments && (
                <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                  vencimento
                  <input
                    type="date"
                    className="input"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
              )}
              {installments ? (
                <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                  parcelas
                  <input
                    type="number"
                    min={2}
                    max={120}
                    className="input w-20"
                    value={count}
                    onChange={(e) => setCount(Math.max(2, Math.floor(Number(e.target.value) || 2)))}
                  />
                </label>
              ) : (
                <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={paid}
                    onChange={(e) => setPaidState(e.target.checked)}
                  />
                  já pago
                </label>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={installments}
                onChange={(e) => setInstallments(e.target.checked)}
              />
              parcelar essa compra
            </label>
          </div>
        )}
      </form>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-[11px] uppercase text-slate-500">Salário do mês</p>
          <MoneyInput
            value={summary.salary}
            onCommit={(v) => void onSetMonthSalary(month, v)}
            className="mt-1"
            ariaLabel="Salário do mês"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {hasSalaryOverride ? 'Valor específico deste mês' : 'Usando o salário padrão'}
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-[11px] uppercase text-slate-500">Gasto do mês</p>
          <p className="mt-2 text-lg font-bold text-rose-400 tabular-nums">{formatBRL(summary.spent)}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            Fixos {formatBRL(summary.fixedTotal)} + variáveis {formatBRL(summary.variableTotal)}
          </p>
        </div>
      </div>

      {activeFixed.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Gastos fixos do mês</h3>
            {(() => {
              const allPaid = activeFixed.every((f) => isFixedPaid(f.id, month))
              return (
                <button
                  className="btn-ghost px-2 py-0.5 text-[11px]"
                  onClick={() => {
                    for (const f of activeFixed) void onSetFixedPaid(f.id, month, !allPaid)
                  }}
                >
                  {allPaid ? 'desmarcar todos' : 'marcar todos pagos'}
                </button>
              )
            })()}
          </div>
          <ul className="mb-4 divide-y divide-slate-800 rounded-xl bg-slate-800/30 px-3">
            {activeFixed.map((f) => {
              const isPaid = isFixedPaid(f.id, month)
              return (
                <li key={f.id} className="flex items-start gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => void onSetFixedPaid(f.id, month, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                    title={isPaid ? 'Pago neste mês' : 'Marcar como pago neste mês'}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${isPaid ? 'text-slate-400' : 'text-slate-100'}`}
                    >
                      {f.name}
                      <MethodBadge method={f.method} />
                      <BankTag bank={f.bank} />
                      <CategoryTag category={f.category} />
                      {!isPaid && <span className="text-[11px] text-amber-300">a pagar</span>}
                    </span>
                    <NoteText note={f.note} />
                  </div>
                  <span
                    className={`shrink-0 tabular-nums ${isPaid ? 'text-slate-500 line-through' : 'text-rose-300'}`}
                  >
                    {formatBRL(Number(f.amount))}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-300">Lançamentos e contas</h3>
        {(rows.length > 0 || activeFixed.length > 0) && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Agrupar por</span>
            <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGroupBy(opt.value)}
                  className={`rounded-md px-2 py-0.5 transition ${
                    groupBy === opt.value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {groups ? (
        groups.length === 0 ? (
          <p className="py-3 text-xs text-slate-500">Nada lançado neste mês.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-400">{g.name}</h4>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    {formatBRL(g.total)}
                  </span>
                </div>
                {g.txs.length > 0 ? (
                  <ul className="divide-y divide-slate-800">{g.txs.map(renderTxRow)}</ul>
                ) : (
                  <p className="text-[11px] text-slate-500">Só gastos fixos deste grupo.</p>
                )}
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <p className="py-3 text-xs text-slate-500">Nada lançado neste mês.</p>
      ) : (
        <ul className="divide-y divide-slate-800">{rows.map(renderTxRow)}</ul>
      )}

      {newCardOpen && (
        <CardModal
          knownBanks={knownBanks}
          onClose={() => setNewCardOpen(false)}
          onSave={async (c) => {
            const created = await onCreateCard(c)
            // o cartão acabou de nascer e ainda não está na lista local: aplica direto
            setMethod('cartao')
            applyCard(created, date)
          }}
        />
      )}
    </div>
  )
}

/** Campo de banco; vira seleção de cartão quando a forma de pagamento é "cartão". */
function BankOrCardField({
  method,
  bank,
  onBank,
  cardId,
  onCard,
  cards,
  knownBanks,
  listId,
  onNewCard,
}: {
  method: PaymentMethod | ''
  bank: string
  onBank: (v: string) => void
  cardId: string
  onCard: (id: string) => void
  cards: Card[]
  knownBanks: string[]
  listId: string
  onNewCard: () => void
}) {
  if (method === 'cartao') {
    return (
      <select
        className="input"
        value={cardId}
        onChange={(e) => (e.target.value === '__new' ? onNewCard() : onCard(e.target.value))}
      >
        <option value="">Cartão…</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__new">+ Novo cartão…</option>
      </select>
    )
  }
  return (
    <>
      <input
        className="input"
        placeholder="Banco…"
        list={listId}
        value={bank}
        onChange={(e) => onBank(e.target.value)}
      />
      <datalist id={listId}>
        {knownBanks.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  )
}

/** "Descontar do saldo de {conta}": aparece quando o banco do lançamento é uma conta cadastrada. */
function DebitCheck({
  account,
  balance,
  checked,
  onChange,
  willWaitPayment,
}: {
  account: SavingsAccount
  balance?: number
  checked: boolean
  onChange: (v: boolean) => void
  willWaitPayment: boolean
}) {
  return (
    <label className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
      <input
        type="checkbox"
        className="h-4 w-4 accent-emerald-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      descontar do saldo de <span className="font-semibold">{account.name}</span>
      {balance != null && <span className="text-slate-500">({formatBRL(balance)})</span>}
      {checked && willWaitPayment && (
        <span className="text-[11px] text-amber-300">· só quando marcar como pago</span>
      )}
    </label>
  )
}

function defaultDate(year: number, month: number): string {
  const now = new Date()
  const day =
    now.getFullYear() === year && now.getMonth() + 1 === month
      ? String(now.getDate()).padStart(2, '0')
      : '01'
  return `${year}-${String(month).padStart(2, '0')}-${day}`
}

function TransactionViewRow({
  tx,
  today,
  cardName,
  accountName,
  onTogglePaid,
  onPostpone,
  onEdit,
  onRemove,
}: {
  tx: Transaction
  today: string
  cardName?: string
  accountName?: string
  onTogglePaid: (v: boolean) => void
  onPostpone: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const overdue = !tx.paid && tx.due_date != null && tx.due_date < today
  return (
    <li className="flex flex-col gap-1.5 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-2">
      <div className="flex min-w-0 items-start gap-2 sm:flex-1">
        <input
          type="checkbox"
          checked={tx.paid}
          onChange={(e) => onTogglePaid(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
          title={tx.paid ? 'Pago' : 'Marcar como pago'}
        />
        <div
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={onEdit}
          role="button"
          tabIndex={0}
          title="Editar"
        >
          <p className={`break-words ${tx.paid ? 'text-slate-300' : 'text-slate-100'}`}>
            {tx.description}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
            <MethodBadge method={tx.method} />
            <BankTag bank={cardName ? `💳 ${cardName}` : tx.bank} />
            <CategoryTag category={tx.category} />
            {accountName && (
              <span className="text-slate-500" title="Valor descontado do saldo desta conta">
                saiu de {accountName}
              </span>
            )}
            {tx.due_date ? (
              <span className={overdue ? 'font-semibold text-rose-400' : ''}>
                vence {formatDate(tx.due_date)}
                {overdue ? ' · atrasada' : ''}
              </span>
            ) : (
              <span>{formatDate(tx.occurred_on)}</span>
            )}
            {!tx.paid && !overdue && <span className="text-amber-300">a pagar</span>}
          </p>
          <NoteText note={tx.note} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <span
          className={`tabular-nums ${tx.paid ? 'text-slate-400 line-through' : 'text-rose-300'}`}
        >
          {formatBRL(Number(tx.amount))}
        </span>
        {overdue && (
          <button
            className="btn-ghost px-2 py-0.5 text-[11px]"
            onClick={onPostpone}
            title="Mover esta conta para o próximo mês"
          >
            adiar →
          </button>
        )}
        <button className="btn-ghost px-2 py-0.5 text-xs" onClick={onEdit} title="Editar lançamento">
          editar
        </button>
        <button
          className="btn-danger px-2 py-0.5 text-xs"
          onClick={onRemove}
          title={tx.group_id ? 'Apagar parcelamento inteiro' : 'Remover'}
        >
          ✕
        </button>
      </div>
    </li>
  )
}

function TransactionEditRow({
  tx,
  knownBanks,
  cards,
  savingsAccounts,
  onNewCard,
  onSave,
  onCancel,
}: {
  tx: Transaction
  knownBanks: string[]
  cards: Card[]
  savingsAccounts: SavingsAccount[]
  onNewCard: () => void
  onSave: (
    patch: Partial<
      Pick<
        Transaction,
        | 'description'
        | 'amount'
        | 'occurred_on'
        | 'due_date'
        | 'method'
        | 'paid'
        | 'category'
        | 'bank'
        | 'note'
        | 'card_id'
        | 'debit_account_id'
      >
    >,
  ) => Promise<void>
  onCancel: () => void
}) {
  const [description, setDescription] = useState(tx.description)
  const [amount, setAmount] = useState(
    Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  )
  const [occurredOn, setOccurredOn] = useState(tx.occurred_on.slice(0, 10))
  const [dueDate, setDueDate] = useState(tx.due_date ? tx.due_date.slice(0, 10) : '')
  const [method, setMethod] = useState<PaymentMethod | ''>(tx.method ?? '')
  const [category, setCategory] = useState(tx.category ?? '')
  const [bank, setBank] = useState(tx.bank ?? '')
  const [cardId, setCardId] = useState(tx.card_id ?? '')
  const [debit, setDebit] = useState(tx.debit_account_id != null)
  const [note, setNote] = useState(tx.note ?? '')
  const [paid, setPaid] = useState(tx.paid)
  const [busy, setBusy] = useState(false)

  const card = cards.find((c) => c.id === cardId) ?? null
  const debitAccount = findDebitAccount(savingsAccounts, bank, method)

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0 || !description.trim()) return
    setBusy(true)
    const usesCard = method === 'cartao' && card
    await onSave({
      description: description.trim(),
      amount: v,
      occurred_on: occurredOn,
      due_date: dueDate || null,
      method: method || null,
      category: category || null,
      bank: usesCard ? card.bank || card.name : bank.trim() || null,
      note: note.trim() || null,
      paid,
      card_id: usesCard ? card.id : null,
      debit_account_id: debitAccount && debit ? debitAccount.id : null,
    })
    setBusy(false)
  }

  return (
    <li className="py-2">
      <form onSubmit={save} className="space-y-2 rounded-lg bg-slate-800/40 p-2">
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição"
          autoFocus
        />
        <input
          className="input"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor 0,00"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            className="input"
            value={method}
            onChange={(e) => {
              const m = e.target.value as PaymentMethod | ''
              setMethod(m)
              if (m !== 'cartao') setCardId('')
            }}
          >
            <option value="">Forma…</option>
            {METHOD_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Categoria…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <BankOrCardField
            method={method}
            bank={bank}
            onBank={setBank}
            cardId={cardId}
            onCard={(id) => {
              setCardId(id)
              const c = cards.find((x) => x.id === id)
              if (c) {
                setBank(c.bank || c.name)
                setDueDate(cardDueDate(c, occurredOn))
              }
            }}
            cards={cards}
            knownBanks={knownBanks}
            listId="banks-edit"
            onNewCard={onNewCard}
          />
        </div>
        {debitAccount && (
          <DebitCheck
            account={debitAccount}
            checked={debit}
            onChange={setDebit}
            willWaitPayment={!paid}
          />
        )}
        <textarea
          className="input w-full resize-y"
          rows={2}
          placeholder="Observação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            data
            <input
              type="date"
              className="input"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            vencimento
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
            pago
          </label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1 py-1.5" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </li>
  )
}
