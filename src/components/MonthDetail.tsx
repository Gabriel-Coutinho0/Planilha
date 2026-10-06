import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type {
  Card,
  CategoryRule,
  FixedExpense,
  PaymentMethod,
  RecurringExpense,
  MonthSummary,
  SavingsAccount,
  Transaction,
} from '../types'
import { CATEGORIES, METHOD_LABEL } from '../types'
import type { TxShare } from '../types'
import { spent } from '../lib/split'
import { MONTHS, formatBRL, formatDate, parseAmount, todayISO } from '../lib/format'
import MoneyInput from './MoneyInput'
import MethodBadge from './MethodBadge'
import CategoryTag from './CategoryTag'
import BankTag from './BankTag'
import NoteText from './NoteText'
import { fixedAppliesToMonth } from '../lib/fixedExpense'
import { cardDueDate, findDebitAccount } from '../lib/cards'
import type { CardInput } from '../lib/useCards'
import type { RecurringInput } from '../lib/useRecurring'
import type { RuleInput } from '../lib/useRules'
import { matchRule, suggestKeyword } from '../lib/rules'
import CardModal from './CardModal'
import BankOrCardField from './BankOrCardField'
import CopyMonthModal from './CopyMonthModal'
import { monthForecast } from '../lib/forecast'

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
  /** Blocos extras (recorrentes, orçamento…) mostrados logo abaixo do formulário. */
  children?: ReactNode
  loadMonth: (year: number, month: number) => Promise<Transaction[]>
  onCopyTransactions: (rows: Transaction[], toYear: number, toMonth: number) => Promise<number>
  onCopied?: (count: number) => void
  /** Cria um gasto fixo (vale do mês atual em diante). */
  onAddFixed: (
    name: string,
    amount: number,
    extra?: {
      category?: string | null
      method?: PaymentMethod | null
      bank?: string | null
      note?: string | null
      startYear?: number | null
      startMonth?: number | null
      cardId?: string | null
    },
  ) => Promise<void>
  /** Cria um recorrente de valor variável e devolve o item criado. */
  onAddRecurring: (r: RecurringInput) => Promise<RecurringExpense>
  onNotify?: (message: string) => void
  /** Abre o pagamento de um boleto (marca pago e desconta de uma conta). */
  onPayBoleto: (tx: Transaction) => void
  onPayFixedBoleto: (f: FixedExpense) => void
  /** Há receitas fixas cadastradas: o tile mostra recebido x previsto em vez do salário. */
  usingIncomeTemplates?: boolean
  rules: CategoryRule[]
  onSaveRule: (r: RuleInput) => Promise<void>
  /** Foca o campo de descrição ao abrir (atalho "Novo lançamento" do celular). */
  autoFocusForm?: boolean
  /** Edita um gasto fixo (vale pra todos os meses em que ele se aplica). */
  onUpdateFixed: (
    id: string,
    patch: Partial<
      Pick<
        FixedExpense,
        | 'name'
        | 'amount'
        | 'category'
        | 'method'
        | 'bank'
        | 'card_id'
        | 'account_id'
        | 'note'
        | 'start_year'
        | 'start_month'
      >
    >,
  ) => Promise<void>
  onSetMonthSalary: (month: number, value: number) => Promise<void>
  onSetFixedPaid: (fixedExpenseId: string, month: number, paid: boolean) => Promise<void>
  /** Partes de pessoas por lançamento (gastos divididos). */
  sharesByTx: Map<string, TxShare[]>
  onSplit: (tx: Transaction) => void
  onAddTransaction: (t: {
    year?: number
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
    recurring_id?: string | null
    split?: string[]
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
    split?: string[]
  }) => Promise<{ addedThisYear: number; addedNextYears: number }>
  onInstallmentsAdded?: (message: string) => void
  onSetPaid: (id: string, paid: boolean) => Promise<void>
  /** Marca vários lançamentos de uma vez como pagos / a pagar. */
  onSetPaidMany: (ids: string[], paid: boolean) => Promise<void>
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

const normText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

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
  children,
  loadMonth,
  onCopyTransactions,
  onCopied,
  onAddFixed,
  onAddRecurring,
  onNotify,
  onPayBoleto,
  onPayFixedBoleto,
  usingIncomeTemplates,
  rules,
  onSaveRule,
  autoFocusForm,
  onUpdateFixed,
  onSetMonthSalary,
  onSetFixedPaid,
  sharesByTx,
  onSplit,
  onAddTransaction,
  onAddInstallments,
  onInstallmentsAdded,
  onSetPaid,
  onSetPaidMany,
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
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null)
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
  const [splitWith, setSplitWith] = useState('')
  const [paid, setPaidState] = useState(true)
  const [installments, setInstallments] = useState(false)
  const [repeat, setRepeat] = useState<'none' | 'fixed' | 'recurring'>('none')
  const [count, setCount] = useState(2)
  const [moreOpen, setMoreOpen] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)
  const [newCardOpen, setNewCardOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const card = cards.find((c) => c.id === cardId) ?? null
  const debitAccount = installments || repeat === 'fixed' ? null : findDebitAccount(savingsAccounts, bank, method)

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

  useEffect(() => {
    if (!autoFocusForm) return
    descRef.current?.focus()
    descRef.current?.scrollIntoView({ block: 'center' })
  }, [autoFocusForm])

  const appliedRule = matchRule(rules, desc)
  const keyword = suggestKeyword(desc)

  function onDescChange(v: string) {
    setDesc(v)
    const r = matchRule(rules, v)
    if (!r) return
    // só preenche o que você ainda não escolheu
    if (r.category && !category) setCategory(r.category)
    if (r.method && !method) pickMethod(r.method)
    if (r.bank && !bank && (r.method ?? method) !== 'cartao') setBank(r.bank)
  }

  async function createRule() {
    await onSaveRule({
      keyword,
      category: category || null,
      method: method || null,
      bank: method === 'cartao' ? null : bank.trim() || null,
    })
    onNotify?.(`Regra criada: "${keyword}" preenche ${category} sozinho.`)
  }

  // aviso de possível duplicado: mesma descrição e valor num intervalo de 45 dias
  const duplicate = useMemo(() => {
    const d = normText(desc)
    const v = parseAmount(amount)
    if (!d || v <= 0) return null
    const base = new Date(date).getTime()
    return (
      transactions.find(
        (t) =>
          normText(t.description) === d &&
          Math.abs(Number(t.amount) - v) < 0.005 &&
          Math.abs(new Date(t.occurred_on.slice(0, 10)).getTime() - base) <= 45 * 86400000,
      ) ?? null
    )
  }, [desc, amount, date, transactions])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0) return
    setBusy(true)
    const splitNames = splitWith.split(',').map((n) => n.trim()).filter(Boolean)
    const bankValue = method === 'cartao' && card ? card.bank || card.name : bank.trim() || null
    if (repeat === 'fixed') {
      // gasto fixo já conta em todos os meses a partir deste: não cria lançamento avulso
      await onAddFixed(desc.trim() || 'Sem descrição', v, {
        category: category || null,
        method: method || null,
        bank: bankValue,
        note: note.trim() || null,
        startYear: year,
        startMonth: month,
        cardId: card?.id ?? null,
      })
      onNotify?.('Gasto fixo criado: vale deste mês em diante.')
    } else if (installments && count > 1) {
      // sem cartão, a 1ª parcela cai no mês da data escolhida
      let startYear = !card && date ? Number(date.slice(0, 4)) : year
      let startMonth = !card && date ? Number(date.slice(5, 7)) : month
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
        split: splitNames,
      })
      const extra = res.addedNextYears > 0 ? ` (${res.addedNextYears} em anos seguintes)` : ''
      onInstallmentsAdded?.(`${count} parcelas adicionadas${extra}.`)
    } else {
      let recurringId: string | null = null
      if (repeat === 'recurring') {
        const dayOf = (iso: string) => Math.min(31, Math.max(1, Number(iso.slice(8, 10)) || 1))
        const item = await onAddRecurring({
          name: desc.trim() || 'Sem descrição',
          amount: v,
          category: category || null,
          method: method || null,
          bank: bankValue,
          card_id: card?.id ?? null,
          // com vencimento (ou ainda a pagar) vira conta com dia; senão entra como gasto já pago
          day: due || !paid ? dayOf(due || date) : null,
          active: true,
        })
        recurringId = item.id
        onNotify?.('Recorrente criado: nos próximos meses aparece o lembrete pra lançar.')
      }
      // sem cartão, o lançamento vai pro mês da data escolhida (comprou pra pagar em novembro = novembro)
      const place = !card && date ? { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) } : { year, month }
      if (place.year !== year || place.month !== month) {
        onNotify?.(`Lançado em ${MONTHS[place.month - 1]}/${place.year}, pelo mês da data escolhida.`)
      }
      await onAddTransaction({
        year: place.year,
        month: place.month,
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
        recurring_id: recurringId,
        split: splitNames,
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
    setSplitWith('')
    setPaidState(true)
    setInstallments(false)
    setRepeat('none')
    setCount(2)
    setBusy(false)
  }

  const positive = summary.remaining >= 0
  const forecast = monthForecast({ transactions, year, month, remaining: summary.remaining })
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
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
        onPayBoleto={t.method === 'boleto' && !t.paid ? () => onPayBoleto(t) : undefined}
        shares={sharesByTx.get(t.id)}
        onSplit={() => onSplit(t)}
        onEdit={() => setEditingId(t.id)}
        onRemove={() => onDeleteTransaction(t)}
      />
    )
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center justify-between gap-1 sm:justify-start">
          <button
            className="btn-ghost px-2.5 py-1"
            onClick={() => onNavigate(-1)}
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <h2 className="flex-1 text-center text-lg font-bold sm:min-w-[9.5rem] sm:flex-none">
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-slate-800/40 px-3 py-2 text-sm font-semibold sm:flex-col sm:items-end sm:gap-y-0 sm:bg-transparent sm:p-0">
          <span className={positive ? 'text-emerald-400' : 'text-rose-400'}>
            Sobra {formatBRL(summary.remaining)}
          </span>
          {summary.pendingCount > 0 && (
            <span className="text-xs text-amber-300">{formatBRL(summary.pendingTotal)} a pagar</span>
          )}
        </div>
      </div>

      <form onSubmit={handleAdd} className="mb-5 space-y-2 rounded-xl bg-slate-800/40 p-3">
        <div className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <input
            className="input col-span-2 sm:col-span-1"
            placeholder="Descrição (ex: mercado, conta de luz)"
            ref={descRef}
            value={desc}
            onChange={(e) => onDescChange(e.target.value)}
          />
          <input
            className="input"
            placeholder="Valor 0,00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="btn-primary" disabled={busy}>
            {busy
              ? 'Salvando…'
              : installments
                ? `Adicionar ${count}x`
                : repeat === 'fixed'
                  ? 'Criar gasto fixo'
                  : repeat === 'recurring'
                    ? 'Adicionar e repetir'
                    : 'Adicionar'}
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
        {appliedRule && (
          <p className="text-[11px] text-sky-300/80">
            🪄 Regra "{appliedRule.keyword}" aplicada ao que ainda estava vazio.
          </p>
        )}
        {!appliedRule && category && keyword.length >= 3 && (
          <button
            type="button"
            className="text-left text-[11px] text-sky-300/80 underline hover:text-sky-200"
            onClick={() => void createRule()}
          >
            🪄 Sempre que a descrição tiver "{keyword}", usar {category}
            {method ? ` · ${METHOD_LABEL[method]}` : ''}
          </button>
        )}
        {duplicate && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
            ⚠️ Já existe "{duplicate.description}" de {formatBRL(Number(duplicate.amount))} em{' '}
            {formatDate(duplicate.occurred_on)}. Se for outra compra, é só adicionar.
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
          {moreOpen ? '▾ menos opções' : '▸ mais opções (data, vencimento, parcelar, repetir, observação)'}
        </button>
        {repeat !== 'none' && (
          <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
            🔁 {repeat === 'fixed' ? 'repete todo mês (fixo)' : 'repete todo mês (valor muda)'}
          </span>
        )}
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
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              dividir com (nomes separados por vírgula, parte igual pra cada um)
              <input
                className="input"
                placeholder="ex.: Pessoa 1, Pessoa 2"
                value={splitWith}
                onChange={(e) => setSplitWith(e.target.value)}
                disabled={repeat === 'fixed'}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={installments}
                disabled={repeat !== 'none'}
                onChange={(e) => {
                  setInstallments(e.target.checked)
                  if (e.target.checked) setRepeat('none')
                }}
              />
              parcelar essa compra
            </label>
            <div>
              <label className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                Repete?
                <select
                  className="input w-auto py-1 text-xs"
                  value={repeat}
                  disabled={installments}
                  onChange={(e) => setRepeat(e.target.value as 'none' | 'fixed' | 'recurring')}
                >
                  <option value="none">Não repete</option>
                  <option value="fixed">Todo mês, mesmo valor (gasto fixo)</option>
                  <option value="recurring">Todo mês, valor muda (recorrente)</option>
                </select>
              </label>
              {repeat === 'fixed' && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Vira um gasto fixo a partir deste mês e entra sozinho nos próximos. Não cria um
                  lançamento avulso (o fixo já conta no mês).
                </p>
              )}
              {repeat === 'recurring' && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Lança agora e, nos próximos meses, aparece um lembrete "Pra lançar neste mês" com
                  este valor sugerido.
                </p>
              )}
            </div>
          </div>
        )}
      </form>

      {children}

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        {usingIncomeTemplates ? (
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-[11px] uppercase text-slate-500">Receitas do mês</p>
            <p className="mt-2 text-lg font-bold text-emerald-400 tabular-nums">
              {formatBRL(summary.incomeReceived)}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              recebido de {formatBRL(summary.salary)} previstos
              {summary.incomePending > 0 && ` · ${formatBRL(summary.incomePending)} a receber`}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-800/50 p-3">
            <p className="text-[11px] uppercase text-slate-500">Salário do mês</p>
            <MoneyInput
              value={summary.baseSalary}
              onCommit={(v) => void onSetMonthSalary(month, v)}
              className="mt-1"
              ariaLabel="Salário do mês"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {hasSalaryOverride ? 'Valor específico deste mês' : 'Usando o salário padrão'}
              {summary.extra > 0 && ` · + ${formatBRL(summary.extra)} de rendas extras`}
            </p>
          </div>
        )}
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-[11px] uppercase text-slate-500">Gasto do mês</p>
          <p className="mt-2 text-lg font-bold text-rose-400 tabular-nums">{formatBRL(summary.spent)}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            Fixos {formatBRL(summary.fixedTotal)} + variáveis {formatBRL(summary.variableTotal)}
          </p>
        </div>
      </div>

      {forecast && (
        <div className="mb-4 rounded-xl bg-slate-800/30 px-3 py-2.5 text-sm">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-slate-400">Previsão pro fim do mês</span>
            <span
              className={`font-bold tabular-nums ${forecast.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {formatBRL(forecast.value)}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {forecast.basis === 'nenhuma'
              ? 'Só o que já está lançado (ainda sem histórico pra estimar o dia a dia).'
              : `Considera ≈ ${formatBRL(forecast.extra)} de gastos do dia a dia ainda por vir (${
                  forecast.basis === 'ritmo' ? 'pelo seu ritmo neste mês' : 'pela média dos meses anteriores'
                }).`}
          </p>
        </div>
      )}

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
              if (editingFixedId === f.id) {
                return (
                  <FixedEditRow
                    key={f.id}
                    fixed={f}
                    cards={cards}
                    accounts={savingsAccounts}
                    knownBanks={knownBanks}
                    onCancel={() => setEditingFixedId(null)}
                    onSave={async (patch) => {
                      await onUpdateFixed(f.id, patch)
                      setEditingFixedId(null)
                    }}
                  />
                )
              }
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
                      {f.account_id && f.method !== 'cartao' && (
                        <span className="text-[11px] text-slate-500">
                          desconta de {accountName(f.account_id)}
                        </span>
                      )}
                      <CategoryTag category={f.category} />
                      {!isPaid && <span className="text-[11px] text-amber-300">a pagar</span>}
                    </span>
                    <NoteText
                      note={f.note}
                      onSave={(v) => void onUpdateFixed(f.id, { note: v || null })}
                    />
                  </div>
                  <span
                    className={`shrink-0 tabular-nums ${isPaid ? 'text-slate-500 line-through' : 'text-rose-300'}`}
                  >
                    {formatBRL(Number(f.amount))}
                  </span>
                  {f.method === 'boleto' && !isPaid && (
                    <button
                      className="btn-primary shrink-0 px-2.5 py-0.5 text-[11px]"
                      onClick={() => onPayFixedBoleto(f)}
                      title="Pagar este boleto e descontar de uma conta"
                    >
                      pagar boleto
                    </button>
                  )}
                  <button
                    className="btn-ghost shrink-0 px-2 py-0.5 text-xs"
                    onClick={() => setEditingFixedId(f.id)}
                    title="Editar este gasto fixo"
                  >
                    editar
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-300">Lançamentos e contas</h3>
          <button
            type="button"
            className="btn-ghost px-2 py-0.5 text-[11px]"
            onClick={() => setCopyOpen(true)}
            title="Trazer lançamentos do mês anterior"
          >
            copiar do mês anterior
          </button>
          {rows.length > 0 &&
            (() => {
              const allPaid = rows.every((t) => t.paid)
              return (
                <button
                  type="button"
                  className="btn-ghost px-2 py-0.5 text-[11px]"
                  onClick={() =>
                    void onSetPaidMany(
                      rows.map((t) => t.id),
                      !allPaid,
                    )
                  }
                  title={allPaid ? 'Voltar todos os lançamentos do mês para "a pagar"' : 'Marcar todos os lançamentos do mês como pagos'}
                >
                  {allPaid ? 'desmarcar todos' : 'marcar todos pagos'}
                </button>
              )
            })()}
        </div>
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

      {copyOpen && (
        <CopyMonthModal
          fromYear={prev.y}
          fromMonth={prev.m}
          toYear={year}
          toMonth={month}
          load={() => loadMonth(prev.y, prev.m)}
          onCopy={(rows) => onCopyTransactions(rows, year, month)}
          onDone={(n) => onCopied?.(n)}
          onClose={() => setCopyOpen(false)}
        />
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
  onPayBoleto,
  onPostpone,
  shares,
  onSplit,
  onEdit,
  onRemove,
}: {
  tx: Transaction
  today: string
  cardName?: string
  accountName?: string
  onTogglePaid: (v: boolean) => void
  onPayBoleto?: () => void
  onPostpone: () => void
  shares?: TxShare[]
  onSplit: () => void
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
            {shares && shares.length > 0 && (
              <span
                className="text-emerald-300"
                title="Dividido: só a sua parte conta como gasto nos gráficos e no resumo"
              >
                dividido · minha parte {formatBRL(spent(tx))} · {shares.map((s) => s.person_name).join(', ')}
                {shares.some((s) => !s.paid) ? ` (${shares.filter((s) => !s.paid).length} a receber)` : ' (todos pagaram)'}
              </span>
            )}
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
        {onPayBoleto && (
          <button
            className="btn-primary px-2.5 py-0.5 text-[11px]"
            onClick={onPayBoleto}
            title="Pagar este boleto e descontar de uma conta"
          >
            pagar boleto
          </button>
        )}
        {overdue && (
          <button
            className="btn-ghost px-2 py-0.5 text-[11px]"
            onClick={onPostpone}
            title="Mover esta conta para o próximo mês"
          >
            adiar →
          </button>
        )}
        <button
          className="btn-ghost px-2 py-0.5 text-xs"
          onClick={onSplit}
          title="Dividir este gasto com outras pessoas"
        >
          dividir
        </button>
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
        | 'year'
        | 'month'
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
      // sem cartão, mudar a data pra outro mês leva o lançamento pra esse mês
      ...(!usesCard && occurredOn && occurredOn !== tx.occurred_on.slice(0, 10)
        ? { year: Number(occurredOn.slice(0, 4)), month: Number(occurredOn.slice(5, 7)) }
        : {}),
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

function FixedEditRow({
  fixed,
  cards,
  accounts,
  knownBanks,
  onSave,
  onCancel,
}: {
  fixed: FixedExpense
  cards: Card[]
  accounts: SavingsAccount[]
  knownBanks: string[]
  onSave: (
    patch: Partial<
      Pick<
        FixedExpense,
        | 'name'
        | 'amount'
        | 'category'
        | 'method'
        | 'bank'
        | 'card_id'
        | 'account_id'
        | 'note'
        | 'start_year'
        | 'start_month'
      >
    >,
  ) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(fixed.name)
  const [amount, setAmount] = useState(
    Number(fixed.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  )
  const [method, setMethod] = useState<PaymentMethod | ''>(fixed.method ?? '')
  const [category, setCategory] = useState(fixed.category ?? '')
  const [bank, setBank] = useState(fixed.bank ?? '')
  const [cardId, setCardId] = useState(fixed.card_id ?? '')
  const [accountId, setAccountId] = useState(fixed.account_id ?? '')
  const [note, setNote] = useState(fixed.note ?? '')
  const [start, setStart] = useState(
    fixed.start_year != null && fixed.start_month != null
      ? `${fixed.start_year}-${String(fixed.start_month).padStart(2, '0')}`
      : '',
  )
  const [busy, setBusy] = useState(false)

  const card = method === 'cartao' ? cards.find((c) => c.id === cardId) : undefined

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const [sy, sm] = start ? start.split('-').map(Number) : [null, null]
    await onSave({
      name: name.trim(),
      amount: parseAmount(amount),
      category: category || null,
      method: method || null,
      bank: card ? card.bank || card.name : bank.trim() || null,
      card_id: card?.id ?? null,
      account_id: method === 'cartao' ? null : accountId || null,
      note: note.trim() || null,
      start_year: sy,
      start_month: sm,
    })
    setBusy(false)
  }

  return (
    <li className="py-2">
      <form onSubmit={save} className="space-y-2 rounded-lg bg-slate-800/40 p-2">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            autoFocus
          />
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Valor 0,00"
          />
        </div>
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
            onCard={(id) => {
              setCardId(id)
              const c = cards.find((x) => x.id === id)
              if (c) setBank(c.bank || c.name)
            }}
            cards={cards}
            knownBanks={knownBanks}
            listId="banks-fixed-edit"
          />
        </div>
        {method !== 'cartao' && accounts.some((a) => a.kind === 'conta') && (
          <select
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            title="Conta de onde sai o pagamento: marcar como pago desconta do saldo dela"
          >
            <option value="">Sem conta (não desconta ao marcar como pago)</option>
            {accounts
              .filter((a) => a.kind === 'conta')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  Sai de {a.name}
                </option>
              ))}
          </select>
        )}
        <textarea
          className="input w-full resize-y"
          rows={2}
          placeholder="Observação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          começa em
          <input
            type="month"
            className="input w-36 py-1 text-[11px]"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <span className="text-slate-500">(vazio = vale desde sempre)</span>
        </label>
        <p className="text-[11px] text-amber-300/80">
          A alteração vale para todos os meses em que este gasto fixo se aplica.
        </p>
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
