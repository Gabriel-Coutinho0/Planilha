import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { FixedExpense, PaymentMethod, MonthSummary, Transaction } from '../types'
import { CATEGORIES, METHOD_LABEL } from '../types'
import { MONTHS, formatBRL, formatDate, parseAmount, todayISO } from '../lib/format'
import MoneyInput from './MoneyInput'
import MethodBadge from './MethodBadge'
import CategoryTag from './CategoryTag'
import BankTag from './BankTag'
import NoteText from './NoteText'

interface Props {
  year: number
  summary: MonthSummary
  transactions: Transaction[]
  fixedExpenses: FixedExpense[]
  hasSalaryOverride: boolean
  knownBanks: string[]
  isFixedPaid: (fixedExpenseId: string, month: number) => boolean
  onClose: () => void
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
  isFixedPaid,
  onClose,
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
  const activeFixed = useMemo(() => fixedExpenses.filter((f) => f.active), [fixedExpenses])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('bank')

  const groups = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, Transaction[]>()
    for (const t of rows) {
      const key = groupBy === 'bank' ? t.bank || NO_BANK : t.category || NO_CATEGORY
      const arr = map.get(key)
      if (arr) arr.push(t)
      else map.set(key, [t])
    }
    return [...map.entries()]
      .map(([name, txs]) => ({
        name,
        txs,
        total: txs.reduce((s, t) => s + Number(t.amount), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [rows, groupBy])

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate(year, month))
  const [due, setDue] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [category, setCategory] = useState('')
  const [bank, setBank] = useState('')
  const [note, setNote] = useState('')
  const [paid, setPaidState] = useState(true)
  const [installments, setInstallments] = useState(false)
  const [count, setCount] = useState(2)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0) return
    setBusy(true)
    if (installments && count > 1) {
      const day = Number(date.slice(8, 10)) || 1
      const res = await onAddInstallments({
        description: desc.trim() || 'Sem descrição',
        count,
        amount: v,
        startYear: year,
        startMonth: month,
        day,
        method: method || null,
        category: category || null,
        bank: bank.trim() || null,
        note: note.trim() || null,
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
        bank: bank.trim() || null,
        note: note.trim() || null,
      })
    }
    setDesc('')
    setAmount('')
    setDue('')
    setMethod('')
    setCategory('')
    setBank('')
    setNote('')
    setPaidState(true)
    setInstallments(false)
    setCount(2)
    setBusy(false)
  }

  const positive = summary.remaining >= 0
  const today = todayISO()

  function renderTxRow(t: Transaction) {
    return editingId === t.id ? (
      <TransactionEditRow
        key={t.id}
        tx={t}
        knownBanks={knownBanks}
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
        onTogglePaid={(v) => void onSetPaid(t.id, v)}
        onPostpone={() => void onPostpone(t.id)}
        onEdit={() => setEditingId(t.id)}
        onRemove={() => onDeleteTransaction(t)}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {MONTHS[month - 1]} <span className="text-slate-500">{year}</span>
            </h2>
            <p className={`text-sm font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              Sobra {formatBRL(summary.remaining)}
              {summary.pendingCount > 0 && (
                <span className="ml-2 text-amber-300">
                  · {formatBRL(summary.pendingTotal)} a pagar
                </span>
              )}
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

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
          {rows.length > 0 && (
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
        {rows.length === 0 ? (
          <p className="mb-3 py-3 text-xs text-slate-500">Nada lançado neste mês.</p>
        ) : groups ? (
          <div className="mb-3 space-y-3">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-400">{g.name}</h4>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    {formatBRL(g.total)}
                  </span>
                </div>
                <ul className="divide-y divide-slate-800">{g.txs.map(renderTxRow)}</ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mb-3 divide-y divide-slate-800">{rows.map(renderTxRow)}</ul>
        )}

        <form onSubmit={handleAdd} className="space-y-2 rounded-xl bg-slate-800/40 p-3">
          <input
            className="input"
            placeholder="Descrição (ex: mercado, conta de luz, cartão)"
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              className="input"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
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
            <input
              className="input"
              placeholder="Banco…"
              list="banks-add"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            />
            <datalist id="banks-add">
              {knownBanks.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
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
                onChange={(e) => setDate(e.target.value)}
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
          <button className="btn-primary w-full" disabled={busy}>
            {busy
              ? 'Salvando…'
              : installments
                ? `Adicionar ${count} parcelas`
                : paid
                  ? 'Adicionar lançamento'
                  : 'Adicionar conta a pagar'}
          </button>
        </form>
      </div>
    </div>
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
  onTogglePaid,
  onPostpone,
  onEdit,
  onRemove,
}: {
  tx: Transaction
  today: string
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
            <BankTag bank={tx.bank} />
            <CategoryTag category={tx.category} />
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
  onSave,
  onCancel,
}: {
  tx: Transaction
  knownBanks: string[]
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
  const [note, setNote] = useState(tx.note ?? '')
  const [paid, setPaid] = useState(tx.paid)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0 || !description.trim()) return
    setBusy(true)
    await onSave({
      description: description.trim(),
      amount: v,
      occurred_on: occurredOn,
      due_date: dueDate || null,
      method: method || null,
      category: category || null,
      bank: bank.trim() || null,
      note: note.trim() || null,
      paid,
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
            onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
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
          <input
            className="input"
            placeholder="Banco…"
            list="banks-edit"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          />
          <datalist id="banks-edit">
            {knownBanks.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
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
