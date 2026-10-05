import { useEffect, useState, type FormEvent } from 'react'
import type { SavingsAccount } from '../types'
import { SAVINGS_KIND_LABEL } from '../types'
import { formatBRL, parseAmount, todayISO } from '../lib/format'

interface Props {
  accounts: SavingsAccount[]
  balanceOf: (id: string) => number
  onClose: () => void
  onTransfer: (t: {
    from: string
    to: string
    amount: number
    occurred_on: string
    note?: string | null
  }) => Promise<void>
}

export default function TransferModal({ accounts, balanceOf, onClose, onTransfer }: Props) {
  const [from, setFrom] = useState(accounts[0]?.id ?? '')
  const [to, setTo] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (!from || !to) return setError('Escolha origem e destino.')
    if (from === to) return setError('Origem e destino precisam ser diferentes.')
    if (v <= 0) return setError('Informe o valor.')
    setBusy(true)
    setError(null)
    try {
      await onTransfer({ from, to, amount: v, occurred_on: date, note: note.trim() || null })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui transferir.')
      setBusy(false)
    }
  }

  const option = (a: SavingsAccount) => (
    <option key={a.id} value={a.id}>
      {a.name} · {SAVINGS_KIND_LABEL[a.kind]} ({formatBRL(balanceOf(a.id))})
    </option>
  )

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Transferir</h2>
            <p className="text-xs text-slate-400">
              Move o dinheiro entre contas e caixinhas sem contar como gasto.
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">De</label>
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
              {accounts.map(option)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Para</label>
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {accounts.map(option)}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Valor 0,00"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
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
          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Transferindo…' : 'Transferir'}
          </button>
        </form>
      </div>
    </div>
  )
}
