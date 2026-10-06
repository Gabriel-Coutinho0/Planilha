import { useEffect, useState } from 'react'
import type { Transaction, TxShare } from '../types'
import { formatBRL } from '../lib/format'
import { equalShares } from '../lib/split'
import type { SplitPerson } from '../lib/shares'
import MoneyInput from './MoneyInput'

interface Props {
  tx: Transaction
  /** Partes já cadastradas deste lançamento (vazio = ainda não foi dividido). */
  shares: TxShare[]
  /** Nomes usados em divisões anteriores, pra sugerir. */
  knownPeople: string[]
  onClose: () => void
  /** `all` = aplicar a todas as parcelas do parcelamento. Lista vazia remove a divisão. */
  onSave: (people: SplitPerson[], all: boolean) => Promise<void>
}

/** Divide um lançamento com outras pessoas: o total fica, mas só a minha parte conta como gasto. */
export default function SplitModal({ tx, shares, knownPeople, onClose, onSave }: Props) {
  const total = Number(tx.amount)
  const [rows, setRows] = useState<SplitPerson[]>(
    shares.length > 0 ? shares.map((s) => ({ name: s.person_name, amount: Number(s.amount) })) : [{ name: '', amount: 0 }],
  )
  const [all, setAll] = useState(!!tx.group_id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const others = rows.reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0)
  const mine = Math.round((total - others) * 100) / 100
  const over = mine < -0.005

  function setRow(i: number, patch: Partial<SplitPerson>) {
    setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function splitEqually() {
    const n = rows.length
    const { each } = equalShares(total, n)
    setRows((cur) => cur.map((r) => ({ ...r, amount: each })))
  }

  async function save() {
    if (over) return
    setBusy(true)
    setError(null)
    try {
      await onSave(rows, all)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar a divisão.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Dividir gasto</h2>
        <p className="mt-1 text-sm text-slate-300">{tx.description}</p>
        <p className="my-2 text-center text-2xl font-bold tabular-nums text-rose-300">{formatBRL(total)}</p>
        <p className="mb-3 text-xs text-slate-500">
          O total continua na fatura e no cartão. Nos gráficos e no gasto do mês entra só a sua parte.
        </p>

        <datalist id="split-people">
          {knownPeople.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>

        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                className="input min-w-0 flex-1"
                list="split-people"
                placeholder="Nome da pessoa"
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
              />
              <MoneyInput
                className="w-32 shrink-0"
                value={r.amount}
                onCommit={(v) => setRow(i, { amount: v })}
                ariaLabel={`Parte de ${r.name || 'pessoa'}`}
              />
              <button
                className="btn-danger px-2 py-1 text-xs"
                onClick={() => setRows((cur) => cur.filter((_, idx) => idx !== i))}
                title="Tirar esta pessoa"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setRows((c) => [...c, { name: '', amount: 0 }])}>
            + pessoa
          </button>
          {rows.length > 0 && (
            <button className="btn-ghost px-2.5 py-1 text-xs" onClick={splitEqually}>
              dividir igualmente (com você)
            </button>
          )}
        </div>

        <p className={`mt-3 text-sm ${over ? 'text-rose-300' : 'text-slate-300'}`}>
          Minha parte: <span className="font-semibold tabular-nums">{formatBRL(Math.max(mine, 0))}</span>
          {over ? ' (as partes passam do total)' : ''}
        </p>

        {tx.group_id && (
          <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            aplicar a todas as parcelas
          </label>
        )}

        {error && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary flex-1" disabled={busy || over} onClick={() => void save()}>
            {busy ? 'Salvando…' : 'Salvar divisão'}
          </button>
          {shares.length > 0 && (
            <button
              className="btn-ghost px-3"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onSave([], all)
                  onClose()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não consegui remover.')
                  setBusy(false)
                }
              }}
            >
              Remover divisão
            </button>
          )}
          <button className="btn-ghost px-4" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
