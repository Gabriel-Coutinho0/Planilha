import { useEffect, useState, type FormEvent } from 'react'
import type { Card } from '../types'
import { formatBRL, parseAmount } from '../lib/format'
import type { CardInput } from '../lib/useCards'

interface Props {
  /** Se vier, edita este cartão; senão cria um novo. */
  card?: Card
  knownBanks: string[]
  onClose: () => void
  onSave: (c: CardInput) => Promise<unknown>
  onRemove?: () => void
}

export default function CardModal({ card, knownBanks, onClose, onSave, onRemove }: Props) {
  const [name, setName] = useState(card?.name ?? '')
  const [bank, setBank] = useState(card?.bank ?? '')
  const [limit, setLimit] = useState(
    card ? Number(card.credit_limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
  )
  const [closing, setClosing] = useState(card?.closing_day ?? 20)
  const [mode, setMode] = useState<'day' | 'offset'>(card?.closing_offset ? 'offset' : 'day')
  const [offset, setOffset] = useState(card?.closing_offset ?? 7)
  const [due, setDue] = useState(card?.due_day ?? 28)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const day = (n: number) => Math.min(31, Math.max(1, Math.floor(n) || 1))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Dê um nome ao cartão.')
    setBusy(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        bank: bank.trim() || null,
        credit_limit: parseAmount(limit),
        closing_day: day(closing),
        closing_offset: mode === 'offset' ? Math.min(28, Math.max(1, Math.floor(offset) || 7)) : null,
        due_day: day(due),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar o cartão.')
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
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold">{card ? 'Editar cartão' : 'Novo cartão'}</h2>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Nome do cartão</label>
            <input
              className="input"
              placeholder="Ex: Nubank Roxinho, Itaú Platinum…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Banco</label>
            <input
              className="input"
              placeholder="Ex: Nubank"
              list="banks-card"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            />
            <datalist id="banks-card">
              {knownBanks.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Limite total</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              onBlur={() => limit && setLimit(formatBRL(parseAmount(limit)).replace('R$', '').trim())}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Fechamento</label>
              <div className="mb-1.5 flex rounded-lg bg-slate-800/60 p-0.5 text-[11px] font-semibold">
                {(
                  [
                    ['day', 'Dia fixo'],
                    ['offset', 'Dias antes'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMode(v)}
                    className={`flex-1 rounded-md px-2 py-1 transition ${
                      mode === v ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {mode === 'day' ? (
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input"
                  value={closing}
                  onChange={(e) => setClosing(Number(e.target.value))}
                />
              ) : (
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="input"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Dia do vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={due}
                onChange={(e) => setDue(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            {mode === 'offset'
              ? `Fecha ${Math.floor(offset) || 7} dias antes do vencimento, então o dia do fechamento acompanha o mês (ex.: 24 ou 25). `
              : 'Fecha sempre no mesmo dia do mês. Se o seu banco muda o dia (24 em um mês, 25 em outro), use "Dias antes". '}
            O limite disponível é calculado: limite menos as compras no cartão que ainda não foram
            pagas (inclui parcelas futuras).
          </p>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? 'Salvando…' : card ? 'Salvar' : 'Criar cartão'}
            </button>
            {card && onRemove && (
              <button type="button" className="btn-danger px-3" onClick={onRemove}>
                Excluir
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
