import { useState, type FormEvent } from 'react'
import type { Card, FixedExpense, FixedShare, PaymentMethod, SavingsAccount } from '../types'
import { fixedSpent } from '../lib/split'
import { findDebitAccount } from '../lib/cards'
import { METHOD_LABEL } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import MoneyInput from './MoneyInput'
import CategoryTag from './CategoryTag'
import MethodBadge from './MethodBadge'
import BankTag from './BankTag'
import NoteText from './NoteText'
import BankOrCardField from './BankOrCardField'
import CategoryOptions from './CategoryOptions'

const METHOD_OPTIONS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

interface FixedExtra {
  category?: string | null
  method?: PaymentMethod | null
  bank?: string | null
  note?: string | null
  startYear?: number | null
  startMonth?: number | null
  cardId?: string | null
  accountId?: string | null
}

interface Props {
  items: FixedExpense[]
  cards: Card[]
  accounts: SavingsAccount[]
  knownBanks: string[]
  onAdd: (name: string, amount: number, extra?: FixedExtra) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<
        FixedExpense,
        'name' | 'amount' | 'active' | 'category' | 'method' | 'bank' | 'note' | 'start_year' | 'start_month' | 'card_id' | 'account_id'
      >
    >,
  ) => Promise<void>
  onRemove: (id: string) => Promise<void>
  /** Partes de pessoas por gasto fixo (divisão). */
  sharesByFixed: Map<string, FixedShare[]>
  onSplit: (f: FixedExpense) => void
}

/** Converte year/month pra valor de <input type="month"> (YYYY-MM), e volta. */
function toMonthInput(y: number | null, m: number | null): string {
  if (y == null || m == null) return ''
  return `${y}-${String(m).padStart(2, '0')}`
}
function fromMonthInput(v: string): { year: number | null; month: number | null } {
  if (!v) return { year: null, month: null }
  const [y, m] = v.split('-').map(Number)
  return { year: y, month: m }
}

function PeriodTag({ f }: { f: FixedExpense }) {
  if (f.start_year == null || f.start_month == null) return null
  return (
    <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
      desde {String(f.start_month).padStart(2, '0')}/{f.start_year}
    </span>
  )
}

export default function FixedExpensesPanel({
  items,
  cards,
  accounts,
  knownBanks,
  onAdd,
  onUpdate,
  onRemove,
  sharesByFixed,
  onSplit,
}: Props) {
  const contas = accounts.filter((a) => a.kind === 'conta')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [bank, setBank] = useState('')
  const [cardId, setCardId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [note, setNote] = useState('')
  const [startInput, setStartInput] = useState('')
  const [busy, setBusy] = useState(false)

  const total = items.filter((i) => i.active).reduce((s, i) => s + Number(i.amount), 0)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    const v = parseAmount(amount)
    if (!n) return
    setBusy(true)
    const start = fromMonthInput(startInput)
    const card = method === 'cartao' ? cards.find((c) => c.id === cardId) : undefined
    await onAdd(n, v, {
      category: category || null,
      method: method || null,
      bank: card ? card.bank || card.name : bank.trim() || null,
      cardId: card?.id ?? null,
      accountId: method === 'cartao' ? null : accountId || null,
      note: note.trim() || null,
      startYear: start.year,
      startMonth: start.month,
    })
    setName('')
    setAmount('')
    setCategory('')
    setMethod('')
    setBank('')
    setCardId('')
    setAccountId('')
    setNote('')
    setStartInput('')
    setBusy(false)
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Gastos fixos</h3>
        <span className="text-sm font-bold text-rose-400 tabular-nums">{formatBRL(total)}</span>
      </div>

      <ul className="mb-3 divide-y divide-slate-800">
        {items.length === 0 && (
          <li className="py-3 text-xs text-slate-500">Nenhum gasto fixo cadastrado ainda.</li>
        )}
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 py-2.5 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={it.active}
                  onChange={(e) => void onUpdate(it.id, { active: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-emerald-500"
                  title={it.active ? 'Ativo' : 'Ignorado no cálculo'}
                />
                <input
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-slate-800"
                  defaultValue={it.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== it.name) void onUpdate(it.id, { name: v })
                  }}
                />
                <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
                  <CategoryTag category={it.category} />
                  <MethodBadge method={it.method} />
                  <BankTag bank={it.bank} />
                  <PeriodTag f={it} />
                </span>
                {(sharesByFixed.get(it.id)?.length ?? 0) > 0 && (
                  <span
                    className="hidden shrink-0 text-[11px] text-emerald-300 sm:inline"
                    title="Dividido: só a sua parte conta como gasto"
                  >
                    minha parte {formatBRL(fixedSpent(it))} · {sharesByFixed.get(it.id)!.map((s) => s.person_name).join(', ')}
                  </span>
                )}
              </div>
              <div className="pl-6">
                <NoteText note={it.note} onSave={(v) => void onUpdate(it.id, { note: v || null })} />
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6 text-[11px] text-slate-400">
                <label className="flex items-center gap-1">
                  começa em
                  <input
                    type="month"
                    className="input w-32 py-1 text-[11px]"
                    value={toMonthInput(it.start_year, it.start_month)}
                    onChange={(e) => {
                      const { year, month } = fromMonthInput(e.target.value)
                      void onUpdate(it.id, { start_year: year, start_month: month })
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-6 lg:flex-nowrap lg:pl-0">
              <select
                className="input w-full sm:w-32"
                value={it.category ?? ''}
                onChange={(e) => void onUpdate(it.id, { category: e.target.value || null })}
              >
                <option value="">Categoria…</option>
                <CategoryOptions />
              </select>
              <select
                className="input w-full sm:w-28"
                value={it.method ?? ''}
                onChange={(e) => {
                  const m = (e.target.value as PaymentMethod) || null
                  void onUpdate(it.id, m === 'cartao' ? { method: m } : { method: m, card_id: null })
                }}
              >
                <option value="">Forma…</option>
                {METHOD_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              {it.method === 'cartao' && cards.length > 0 ? (
                <select
                  className="input w-full sm:w-32"
                  value={it.card_id ?? ''}
                  onChange={(e) => {
                    const c = cards.find((x) => x.id === e.target.value)
                    void onUpdate(it.id, {
                      card_id: c?.id ?? null,
                      ...(c ? { bank: c.bank || c.name } : {}),
                    })
                  }}
                >
                  <option value="">Cartão…</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input w-full sm:w-28"
                  placeholder="Banco…"
                  list="fixed-banks"
                  defaultValue={it.bank ?? ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (it.bank ?? '')) void onUpdate(it.id, { bank: v || null })
                  }}
                />
              )}
              {it.method !== 'cartao' && contas.length > 0 && (
                <select
                  className="input w-full sm:w-36"
                  value={it.account_id ?? ''}
                  onChange={(e) => void onUpdate(it.id, { account_id: e.target.value || null })}
                  title="Conta de onde sai o pagamento: marcar como pago desconta do saldo dela"
                >
                  <option value="">Sem conta (não desconta)</option>
                  {contas.map((a) => (
                    <option key={a.id} value={a.id}>
                      Sai de {a.name}
                    </option>
                  ))}
                </select>
              )}
              <MoneyInput
                value={Number(it.amount)}
                onCommit={(v) => void onUpdate(it.id, { amount: v })}
                className="w-28 shrink-0"
                ariaLabel={`Valor de ${it.name}`}
              />
              <button
                className="btn-ghost shrink-0 px-2 py-1 text-xs"
                onClick={() => onSplit(it)}
                title="Dividir este gasto fixo com outras pessoas"
              >
                dividir
              </button>
              <button
                className="btn-danger shrink-0 px-2 py-1 text-xs"
                onClick={() => void onRemove(it.id)}
                title="Remover"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          className="input basis-full sm:flex-1"
          placeholder="Ex: Aluguel, Academia, Internet…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="input w-full basis-full sm:w-36 sm:basis-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Categoria…</option>
          <CategoryOptions />
        </select>
        <select
          className="input w-full basis-full sm:w-28 sm:basis-auto"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as PaymentMethod | '')
            if (e.target.value !== 'cartao') setCardId('')
          }}
        >
          <option value="">Forma…</option>
          {METHOD_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <div className="w-full basis-full sm:w-32 sm:basis-auto">
          <BankOrCardField
            method={method}
            bank={bank}
            onBank={(v) => {
              setBank(v)
              // sugere a conta quando o banco digitado é uma conta cadastrada
              if (!accountId) {
                const a = findDebitAccount(accounts, v, method)
                if (a) setAccountId(a.id)
              }
            }}
            cardId={cardId}
            onCard={setCardId}
            cards={cards}
            knownBanks={knownBanks}
            listId="fixed-banks-form"
          />
        </div>
        {method !== 'cartao' && contas.length > 0 && (
          <select
            className="input w-full basis-full sm:w-44 sm:basis-auto"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            title="Conta de onde sai o pagamento: marcar como pago desconta do saldo dela"
          >
            <option value="">Sai de qual conta?</option>
            {contas.map((a) => (
              <option key={a.id} value={a.id}>
                Sai de {a.name}
              </option>
            ))}
          </select>
        )}
        <datalist id="fixed-banks">
          {knownBanks.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <input
          className="input w-28 flex-1 sm:flex-none"
          placeholder="0,00"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label className="flex basis-full items-center gap-1.5 text-[11px] text-slate-400 sm:basis-auto">
          começa em
          <input
            type="month"
            className="input py-1.5"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
          />
        </label>
        <p className="basis-full text-[10px] text-slate-500">
          Deixe em branco pra um gasto sem início definido (vale desde já).
        </p>
        <input
          className="input basis-full"
          placeholder="Observação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={busy}>
          Adicionar
        </button>
      </form>
    </div>
  )
}
