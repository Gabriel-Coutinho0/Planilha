import { useState, type FormEvent } from 'react'
import type { Card, PaymentMethod, RecurringExpense } from '../types'
import { METHOD_LABEL } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import type { RecurringInput } from '../lib/useRecurring'
import MoneyInput from './MoneyInput'
import BankOrCardField from './BankOrCardField'
import CategoryOptions from './CategoryOptions'

const METHOD_OPTIONS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

interface Props {
  items: RecurringExpense[]
  cards: Card[]
  knownBanks: string[]
  onAdd: (r: RecurringInput) => Promise<unknown>
  onUpdate: (id: string, patch: Partial<RecurringInput>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export default function RecurringPanel({ items, cards, knownBanks, onAdd, onUpdate, onRemove }: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [bank, setBank] = useState('')
  const [cardId, setCardId] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const card = method === 'cartao' ? cards.find((c) => c.id === cardId) : undefined
    const d = Math.floor(Number(day))
    await onAdd({
      name: name.trim(),
      amount: parseAmount(amount),
      category: category || null,
      method: method || null,
      bank: card ? card.bank || card.name : bank.trim() || null,
      card_id: card?.id ?? null,
      day: d >= 1 && d <= 31 ? d : null,
      active: true,
    })
    setName('')
    setAmount('')
    setDay('')
    setCategory('')
    setMethod('')
    setBank('')
    setCardId('')
    setBusy(false)
  }

  return (
    <div className="card p-4">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-slate-300">Recorrentes de valor variável</h3>
        <p className="text-[11px] text-slate-500">
          Luz, água, mercado… repetem todo mês, mas o valor muda. No mês aparece um lembrete pra você
          lançar já com o valor do mês passado.
        </p>
      </div>

      <ul className="my-3 divide-y divide-slate-800">
        {items.length === 0 && (
          <li className="py-3 text-xs text-slate-500">Nenhum recorrente cadastrado ainda.</li>
        )}
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={it.active}
              onChange={(e) => void onUpdate(it.id, { active: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
              title={it.active ? 'Ativo' : 'Pausado'}
            />
            <input
              className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-slate-800"
              defaultValue={it.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== it.name) void onUpdate(it.id, { name: v })
              }}
            />
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              {it.category ?? 'Sem categoria'}
              {it.day ? ` · dia ${it.day}` : ' · sem vencimento'}
            </span>
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              dia
              <input
                type="number"
                min={1}
                max={31}
                className="input w-14 py-1 text-[11px]"
                defaultValue={it.day ?? ''}
                onBlur={(e) => {
                  const v = Math.floor(Number(e.target.value))
                  const next = v >= 1 && v <= 31 ? v : null
                  if (next !== it.day) void onUpdate(it.id, { day: next })
                }}
              />
            </label>
            <MoneyInput
              value={Number(it.amount)}
              onCommit={(v) => void onUpdate(it.id, { amount: v })}
              className="w-28 shrink-0"
              ariaLabel={`Valor estimado de ${it.name}`}
            />
            <button
              className="btn-danger shrink-0 px-2 py-1 text-xs"
              onClick={() => void onRemove(it.id)}
              title="Remover"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          className="input basis-full sm:flex-1"
          placeholder="Ex: Conta de luz, Água, Mercado…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-28 flex-1 sm:flex-none"
          placeholder="Valor médio"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={31}
          className="input w-24"
          placeholder="Dia"
          title="Dia do vencimento (deixe vazio se não tem)"
          value={day}
          onChange={(e) => setDay(e.target.value)}
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
        <div className="w-full basis-full sm:w-36 sm:basis-auto">
          <BankOrCardField
            method={method}
            bank={bank}
            onBank={setBank}
            cardId={cardId}
            onCard={setCardId}
            cards={cards}
            knownBanks={knownBanks}
            listId="recurring-banks"
          />
        </div>
        <button className="btn-primary shrink-0" disabled={busy}>
          Adicionar
        </button>
        <p className="basis-full text-[10px] text-slate-500">
          Com dia de vencimento vira conta a pagar (média: {formatBRL(parseAmount(amount))}); sem dia,
          entra como gasto já pago.
        </p>
      </form>
    </div>
  )
}
