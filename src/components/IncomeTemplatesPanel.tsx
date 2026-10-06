import { useState, type FormEvent } from 'react'
import type { IncomeTemplate, SavingsAccount } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import MoneyInput from './MoneyInput'

interface Props {
  templates: IncomeTemplate[]
  accounts: SavingsAccount[]
  onAdd: (t: Omit<IncomeTemplate, 'id' | 'user_id' | 'created_at'>) => Promise<unknown>
  onUpdate: (id: string, patch: Partial<Omit<IncomeTemplate, 'id' | 'user_id' | 'created_at'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

const toMonthInput = (y: number | null, m: number | null) =>
  y == null || m == null ? '' : `${y}-${String(m).padStart(2, '0')}`
const fromMonthInput = (v: string): [number | null, number | null] =>
  v ? (v.split('-').map(Number) as [number, number]) : [null, null]

/** Receitas fixas (salário…): previstas todo mês até você confirmar o recebimento. */
export default function IncomeTemplatesPanel({ templates, accounts, onAdd, onUpdate, onRemove }: Props) {
  const contas = accounts.filter((a) => a.kind === 'conta')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('')
  const [account, setAccount] = useState('')
  const [start, setStart] = useState('')
  const [busy, setBusy] = useState(false)
  const total = templates.filter((t) => t.active).reduce((s, t) => s + Number(t.amount), 0)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const d = Math.floor(Number(day))
    const [sy, sm] = fromMonthInput(start)
    await onAdd({
      name: name.trim(),
      amount: parseAmount(amount),
      day: d >= 1 && d <= 31 ? d : null,
      account_id: account || null,
      active: true,
      start_year: sy,
      start_month: sm,
    })
    setName('')
    setAmount('')
    setDay('')
    setStart('')
    setBusy(false)
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="text-sm font-semibold text-slate-300">Receitas fixas</h3>
          <p className="text-[11px] text-slate-500">
            Salário e outras entradas que se repetem. Aparecem como "a receber" todo mês até você confirmar o
            recebimento. Enquanto houver receita fixa cadastrada, o "salário padrão" deixa de contar sozinho.
          </p>
        </div>
        <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatBRL(total)}</span>
      </div>

      <ul className="mb-3 divide-y divide-slate-800">
        {templates.length === 0 && (
          <li className="py-3 text-xs text-slate-500">Nenhuma receita fixa cadastrada ainda.</li>
        )}
        {templates.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={t.active}
              onChange={(e) => void onUpdate(t.id, { active: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
              title={t.active ? 'Ativa' : 'Pausada'}
            />
            <input
              className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-slate-800"
              defaultValue={t.name}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== t.name) void onUpdate(t.id, { name: v })
              }}
            />
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              dia
              <input
                type="number"
                min={1}
                max={31}
                className="input w-14 py-1 text-[11px]"
                defaultValue={t.day ?? ''}
                onBlur={(e) => {
                  const v = Math.floor(Number(e.target.value))
                  const next = v >= 1 && v <= 31 ? v : null
                  if (next !== t.day) void onUpdate(t.id, { day: next })
                }}
              />
            </label>
            {contas.length > 0 && (
              <select
                className="input w-auto py-1 text-xs"
                value={t.account_id ?? ''}
                onChange={(e) => void onUpdate(t.id, { account_id: e.target.value || null })}
              >
                <option value="">Sem conta</option>
                {contas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="month"
              className="input w-32 py-1 text-[11px]"
              title="Começa em (vazio = desde sempre)"
              value={toMonthInput(t.start_year, t.start_month)}
              onChange={(e) => {
                const [sy, sm] = fromMonthInput(e.target.value)
                void onUpdate(t.id, { start_year: sy, start_month: sm })
              }}
            />
            <MoneyInput
              value={Number(t.amount)}
              onCommit={(v) => void onUpdate(t.id, { amount: v })}
              className="w-28 shrink-0"
              ariaLabel={`Valor de ${t.name}`}
            />
            <button
              className="btn-danger shrink-0 px-2 py-1 text-xs"
              onClick={() => void onRemove(t.id)}
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
          placeholder="Ex: Salário, Vale, Aluguel recebido…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-28 flex-1 sm:flex-none"
          placeholder="Valor"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={31}
          className="input w-20"
          placeholder="Dia"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        {contas.length > 0 && (
          <select
            className="input w-full basis-full sm:w-40 sm:basis-auto"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Conta de destino…</option>
            {contas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex basis-full items-center gap-1.5 text-[11px] text-slate-400 sm:basis-auto">
          começa em
          <input
            type="month"
            className="input py-1.5"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <button className="btn-primary shrink-0" disabled={busy}>
          Adicionar
        </button>
      </form>
    </div>
  )
}
