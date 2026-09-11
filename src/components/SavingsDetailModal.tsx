import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { MovementKind, SavingsAccount, SavingsMovement } from '../types'
import { SAVINGS_KIND_LABEL } from '../types'
import { formatBRL, formatDate, parseAmount, todayISO } from '../lib/format'

interface Props {
  account: SavingsAccount
  movements: SavingsMovement[]
  balance: number
  onClose: () => void
  onAddMovement: (m: {
    account_id: string
    amount: number
    kind: MovementKind
    occurred_on: string
    note?: string | null
  }) => Promise<void>
  onRemoveMovement: (id: string) => Promise<void>
  onRemoveAccount: (id: string) => Promise<void>
}

export default function SavingsDetailModal({
  account,
  movements,
  balance,
  onClose,
  onAddMovement,
  onRemoveMovement,
  onRemoveAccount,
}: Props) {
  const [kind, setKind] = useState<MovementKind>('deposito')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(
    () => [...movements].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
    [movements],
  )

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
    if (v <= 0) return setError('Informe um valor.')
    if (kind === 'retirada' && v > balance) {
      if (!confirm(`Isso deixa o saldo negativo (${formatBRL(balance - v)}). Continuar?`)) return
    }
    setError(null)
    setBusy(true)
    try {
      await onAddMovement({ account_id: account.id, amount: v, kind, occurred_on: date, note: note.trim() || null })
      setAmount('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAccount() {
    if (!confirm(`Apagar "${account.name}" e todo o histórico dela? Isso não pode ser desfeito.`)) return
    await onRemoveAccount(account.id)
    onClose()
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
            <h2 className="text-lg font-bold">{account.name}</h2>
            <p className="text-xs text-slate-400">
              {SAVINGS_KIND_LABEL[account.kind]}
              {account.institution ? ` · guardado em ${account.institution}` : ''}
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-slate-800/50 p-4 text-center">
          <p className="text-[11px] uppercase text-slate-500">Saldo atual</p>
          <p
            className={`text-2xl font-bold tabular-nums ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {formatBRL(balance)}
          </p>
        </div>

        <form onSubmit={handleAdd} className="mb-4 space-y-2 rounded-xl bg-slate-800/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind('deposito')}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                kind === 'deposito'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              + Depositar
            </button>
            <button
              type="button"
              onClick={() => setKind('retirada')}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                kind === 'retirada'
                  ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              − Retirar
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Valor 0,00"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="date"
              className="input w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <input
            className="input"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            className={`btn-primary w-full ${kind === 'retirada' ? '!bg-rose-500 hover:!bg-rose-400' : ''}`}
            disabled={busy}
          >
            {busy ? 'Salvando…' : kind === 'deposito' ? 'Depositar' : 'Retirar'}
          </button>
        </form>

        <h3 className="mb-2 text-sm font-semibold text-slate-300">Histórico</h3>
        <ul className="mb-4 divide-y divide-slate-800">
          {rows.length === 0 && (
            <li className="py-3 text-xs text-slate-500">Nenhuma movimentação ainda.</li>
          )}
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-16 shrink-0 text-[11px] text-slate-500">
                {formatDate(m.occurred_on)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-200">{m.kind === 'deposito' ? 'Depósito' : 'Retirada'}</p>
                {m.note && <p className="truncate text-[11px] text-slate-500">{m.note}</p>}
              </div>
              <span
                className={`shrink-0 tabular-nums ${m.kind === 'deposito' ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {m.kind === 'deposito' ? '+' : '−'} {formatBRL(Number(m.amount))}
              </span>
              <button
                className="btn-danger shrink-0 px-2 py-0.5 text-xs"
                onClick={() => void onRemoveMovement(m.id)}
                title="Remover"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <button
          className="text-xs text-rose-400 underline hover:text-rose-300"
          onClick={handleDeleteAccount}
        >
          Apagar esta {SAVINGS_KIND_LABEL[account.kind].toLowerCase()}
        </button>
      </div>
    </div>
  )
}
