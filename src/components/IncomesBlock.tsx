import { useState, type FormEvent } from 'react'
import type { ExtraIncome } from '../types'
import { formatBRL, parseAmount } from '../lib/format'

interface Props {
  incomes: ExtraIncome[]
  onAdd: (description: string, amount: number) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

/** Rendas extras do mês (13º, freela, reembolso), somadas ao salário na sobra. */
export default function IncomesBlock({ incomes, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const total = incomes.reduce((s, i) => s + Number(i.amount), 0)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0) return
    setBusy(true)
    await onAdd(desc.trim() || 'Renda extra', v)
    setDesc('')
    setAmount('')
    setBusy(false)
  }

  return (
    <div className="mb-4 rounded-xl bg-slate-800/30 p-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-x-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-slate-300">
          Rendas extras do mês {open ? '▾' : '▸'}
        </h3>
        <span className="text-xs font-semibold tabular-nums text-emerald-300">
          {incomes.length > 0 ? `+ ${formatBRL(total)}` : 'adicionar 13º, freela, reembolso…'}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          {incomes.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-800">
              {incomes.map((i) => (
                <li key={i.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-200">{i.description}</span>
                  <span className="shrink-0 tabular-nums text-emerald-300">
                    + {formatBRL(Number(i.amount))}
                  </span>
                  <button
                    className="btn-danger shrink-0 px-2 py-0.5 text-xs"
                    onClick={() => void onRemove(i.id)}
                    title="Remover"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAdd} className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <input
              className="input col-span-2 sm:col-span-1"
              placeholder="Descrição (ex: 13º, freela)"
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
              Adicionar
            </button>
          </form>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Entra na renda do mês e aumenta a sobra. O salário continua sendo editado no campo "Salário do mês".
          </p>
        </div>
      )}
    </div>
  )
}
