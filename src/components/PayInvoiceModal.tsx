import { useEffect, useState } from 'react'
import type { SavingsAccount } from '../types'
import type { Invoice } from '../lib/invoices'
import { findDebitAccount } from '../lib/cards'
import { formatBRL, formatDate } from '../lib/format'

interface Props {
  invoice: Invoice
  accounts: SavingsAccount[]
  balanceOf: (id: string) => number
  onClose: () => void
  onConfirm: (accountId: string | null) => Promise<void>
}

export default function PayInvoiceModal({ invoice, accounts, balanceOf, onClose, onConfirm }: Props) {
  const contas = accounts.filter((a) => a.kind === 'conta')
  const [accountId, setAccountId] = useState(
    findDebitAccount(accounts, invoice.card.bank ?? invoice.card.name, null)?.id ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(accountId || null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui pagar a fatura.')
      setBusy(false)
    }
  }

  const count = invoice.txs.length + invoice.fixed.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Pagar fatura</h2>
        <p className="mt-1 text-sm text-slate-400">
          💳 {invoice.card.name} · vence {formatDate(invoice.dueDate)}
        </p>
        <p className="my-3 text-center text-3xl font-bold tabular-nums text-rose-300">
          {formatBRL(invoice.total)}
        </p>
        <p className="mb-3 text-center text-[11px] text-slate-500">
          {count} {count === 1 ? 'item será marcado' : 'itens serão marcados'} como pago
        </p>

        <label className="mb-1 block text-xs font-medium text-slate-400">Pagar com o saldo de</label>
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Não descontar de nenhuma conta</option>
          {contas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatBRL(balanceOf(a.id))})
            </option>
          ))}
        </select>

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
