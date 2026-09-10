import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { PaymentMethod, MonthSummary, Transaction } from '../types'
import { METHOD_LABEL } from '../types'
import { MONTHS, formatBRL, formatDate, parseAmount, todayISO } from '../lib/format'
import MoneyInput from './MoneyInput'
import MethodBadge from './MethodBadge'

interface Props {
  year: number
  summary: MonthSummary
  transactions: Transaction[]
  hasSalaryOverride: boolean
  onClose: () => void
  onSetMonthSalary: (month: number, value: number) => Promise<void>
  onAddTransaction: (t: {
    month: number
    description: string
    amount: number
    occurred_on: string
    paid?: boolean
    due_date?: string | null
    method?: PaymentMethod | null
  }) => Promise<void>
  onSetPaid: (id: string, paid: boolean) => Promise<void>
  onPostpone: (id: string) => Promise<void>
  onUpdateTransaction: (
    id: string,
    patch: Partial<
      Pick<Transaction, 'description' | 'amount' | 'occurred_on' | 'due_date' | 'method' | 'paid'>
    >,
  ) => Promise<void>
  onRemoveTransaction: (id: string, groupId?: string | null) => Promise<number>
}

const METHOD_OPTIONS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

export default function MonthDetail({
  year,
  summary,
  transactions,
  hasSalaryOverride,
  onClose,
  onSetMonthSalary,
  onAddTransaction,
  onSetPaid,
  onPostpone,
  onUpdateTransaction,
  onRemoveTransaction,
}: Props) {
  const { month } = summary
  const rows = useMemo(
    () => transactions.filter((t) => t.month === month),
    [transactions, month],
  )
  const [editingId, setEditingId] = useState<string | null>(null)

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate(year, month))
  const [due, setDue] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [paid, setPaidState] = useState(true)
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
    await onAddTransaction({
      month,
      description: desc.trim() || 'Sem descrição',
      amount: v,
      occurred_on: date,
      paid,
      due_date: due || null,
      method: method || null,
    })
    setDesc('')
    setAmount('')
    setDue('')
    setMethod('')
    setPaidState(true)
    setBusy(false)
  }

  async function handleRemove(t: Transaction) {
    if (t.group_id) {
      const total = transactions.filter((x) => x.group_id === t.group_id).length
      if (!confirm(`"${t.description}" faz parte de um parcelamento. Apagar todas as ${total} parcelas?`)) return
      await onRemoveTransaction(t.id, t.group_id)
    } else {
      await onRemoveTransaction(t.id)
    }
  }

  const positive = summary.remaining >= 0
  const today = todayISO()

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

        <h3 className="mb-2 text-sm font-semibold text-slate-300">Lançamentos e contas</h3>
        <ul className="mb-3 divide-y divide-slate-800">
          {rows.length === 0 && (
            <li className="py-3 text-xs text-slate-500">Nada lançado neste mês.</li>
          )}
          {rows.map((t) =>
            editingId === t.id ? (
              <TransactionEditRow
                key={t.id}
                tx={t}
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
                onRemove={() => void handleRemove(t)}
              />
            ),
          )}
        </ul>

        <form onSubmit={handleAdd} className="space-y-2 rounded-xl bg-slate-800/40 p-3">
          <input
            className="input"
            placeholder="Descrição (ex: mercado, conta de luz, cartão)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Valor 0,00"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
              className="input w-32"
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              data
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              vencimento
              <input
                type="date"
                className="input"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={paid}
                onChange={(e) => setPaidState(e.target.checked)}
              />
              já pago
            </label>
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Salvando…' : paid ? 'Adicionar lançamento' : 'Adicionar conta a pagar'}
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
    <li className="flex items-center gap-2 py-2 text-sm">
      <input
        type="checkbox"
        checked={tx.paid}
        onChange={(e) => onTogglePaid(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-emerald-500"
        title={tx.paid ? 'Pago' : 'Marcar como pago'}
      />
      <button className="min-w-0 flex-1 text-left" onClick={onEdit} title="Editar">
        <p className={`truncate ${tx.paid ? 'text-slate-300' : 'text-slate-100'}`}>{tx.description}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <MethodBadge method={tx.method} />
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
      </button>
      <span
        className={`shrink-0 tabular-nums ${tx.paid ? 'text-slate-400 line-through' : 'text-rose-300'}`}
      >
        {formatBRL(Number(tx.amount))}
      </span>
      {overdue && (
        <button
          className="btn-ghost shrink-0 px-2 py-0.5 text-[11px]"
          onClick={onPostpone}
          title="Mover esta conta para o próximo mês"
        >
          adiar →
        </button>
      )}
      <button
        className="btn-ghost shrink-0 px-2 py-0.5 text-xs"
        onClick={onEdit}
        title="Editar lançamento"
      >
        ✎
      </button>
      <button
        className="btn-danger shrink-0 px-2 py-0.5 text-xs"
        onClick={onRemove}
        title={tx.group_id ? 'Apagar parcelamento inteiro' : 'Remover'}
      >
        ✕
      </button>
    </li>
  )
}

function TransactionEditRow({
  tx,
  onSave,
  onCancel,
}: {
  tx: Transaction
  onSave: (
    patch: Partial<
      Pick<Transaction, 'description' | 'amount' | 'occurred_on' | 'due_date' | 'method' | 'paid'>
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
        <div className="flex gap-2">
          <input
            className="input flex-1"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Valor 0,00"
          />
          <select
            className="input w-28"
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            data
            <input
              type="date"
              className="input"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
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
