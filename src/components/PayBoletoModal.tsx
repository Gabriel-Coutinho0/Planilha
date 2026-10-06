import { useEffect, useState } from 'react'
import type { SavingsAccount } from '../types'
import { formatBRL, formatDate, todayISO } from '../lib/format'

interface Props {
  title: string
  dueDate: string | null
  amount: number
  /** Contas bancárias (de onde o dinheiro pode sair). */
  accounts: SavingsAccount[]
  balanceOf: (accountId: string) => number
  defaultAccountId: string | null
  onClose: () => void
  onConfirm: (accountId: string | null, paidOn: string) => Promise<void>
}

/** Pagar um boleto: marca como pago e tira o valor do saldo da conta escolhida. */
export default function PayBoletoModal({
  title,
  dueDate,
  amount,
  accounts,
  balanceOf,
  defaultAccountId,
  onClose,
  onConfirm,
}: Props) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? '')
  const [paidOn, setPaidOn] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = accounts.find((a) => a.id === accountId)
  const after = selected ? balanceOf(selected.id) - amount : null

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(accountId || null, paidOn || todayISO())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui registrar o pagamento.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Pagar boleto</h2>
        <p className="mt-1 text-sm text-slate-300">{title}</p>
        {dueDate && <p className="text-xs text-slate-500">vence {formatDate(dueDate)}</p>}
        <p className="my-3 text-center text-3xl font-bold tabular-nums text-rose-300">{formatBRL(amount)}</p>

        <label className="mb-1 block text-xs font-medium text-slate-400">Pagar com o saldo de</label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Só marcar como pago (não descontar de conta)</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatBRL(balanceOf(a.id))})
            </option>
          ))}
        </select>
        {selected && after != null && (
          <p className={`mt-1 text-[11px] ${after < 0 ? 'text-rose-300' : 'text-slate-500'}`}>
            Saldo de {selected.name} depois: {formatBRL(after)}
            {after < 0 ? ' (ficará negativo)' : ''}
          </p>
        )}

        <label className="mb-1 mt-3 block text-xs font-medium text-slate-400">Data do pagamento</label>
        <input type="date" className="input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />

        {error && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Pagando…' : 'Confirmar pagamento'}
          </button>
          <button className="btn-ghost px-4" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
