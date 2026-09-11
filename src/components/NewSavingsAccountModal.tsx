import { useEffect, useState, type FormEvent } from 'react'
import { SAVINGS_KIND_LABEL, type SavingsKind } from '../types'
import { parseAmount } from '../lib/format'

interface Props {
  knownBanks: string[]
  onClose: () => void
  onCreate: (a: {
    name: string
    kind: SavingsKind
    institution?: string | null
    initialAmount?: number
  }) => Promise<void>
}

const NAME_PLACEHOLDER: Record<SavingsKind, string> = {
  conta: 'Ex: Nubank, Itaú, Inter…',
  caixinha: 'Ex: Reserva de emergência, Viagem…',
  investimento: 'Ex: Tesouro Selic, CDB, Ações…',
}

export default function NewSavingsAccountModal({ knownBanks, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<SavingsKind>('caixinha')
  const [institution, setInstitution] = useState('')
  const [initial, setInitial] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Dê um nome.')
    setBusy(true)
    setError(null)
    try {
      await onCreate({
        name: name.trim(),
        kind,
        institution: institution.trim() || null,
        initialAmount: parseAmount(initial),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui criar.')
      setBusy(false)
    }
  }

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
          <h2 className="text-lg font-bold">Nova conta, caixinha ou investimento</h2>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(SAVINGS_KIND_LABEL) as [SavingsKind, string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setKind(v)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                  kind === v
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              {kind === 'conta' ? 'Nome do banco' : 'Nome'}
            </label>
            <input
              className="input"
              placeholder={NAME_PLACEHOLDER[kind]}
              list={kind === 'conta' ? 'savings-banks' : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {kind === 'conta' && (
              <datalist id="savings-banks">
                {knownBanks.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              {kind === 'conta' ? 'Agência/observação (opcional)' : 'Onde está guardado'}
            </label>
            <input
              className="input"
              placeholder="Ex: Nubank, XP, Banco Inter…"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              {kind === 'conta' ? 'Saldo atual (opcional)' : 'Saldo inicial (opcional)'}
            </label>
            <input
              className="input"
              placeholder="0,00"
              inputMode="decimal"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Criando…' : 'Criar'}
          </button>
        </form>
      </div>
    </div>
  )
}
