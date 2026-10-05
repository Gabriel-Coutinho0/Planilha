import { useEffect, useMemo, useState } from 'react'
import type { Transaction } from '../types'
import { MONTHS_SHORT, formatBRL, formatDate } from '../lib/format'

export interface Move {
  id: string
  year: number
  month: number
}

/** Lançamentos de cartão não pagos que estão num mês diferente do mês da data da compra. */
export function findMisplaced(pending: Transaction[]): Array<{ tx: Transaction; to: { year: number; month: number } }> {
  const out: Array<{ tx: Transaction; to: { year: number; month: number } }> = []
  for (const tx of pending) {
    if (!tx.card_id || tx.group_id) continue
    const year = +tx.occurred_on.slice(0, 4)
    const month = +tx.occurred_on.slice(5, 7)
    if (year !== tx.year || month !== tx.month) out.push({ tx, to: { year, month } })
  }
  return out.sort((a, b) => a.tx.occurred_on.localeCompare(b.tx.occurred_on))
}

interface Props {
  items: ReturnType<typeof findMisplaced>
  onClose: () => void
  onMove: (moves: Move[]) => Promise<void>
}

const label = (y: number, m: number) => `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`

export default function ReorganizeCardModal({ items, onClose, onMove }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map((i) => i.tx.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chosen = useMemo(() => items.filter((i) => selected.has(i.tx.id)), [items, selected])
  const total = chosen.reduce((s, i) => s + Number(i.tx.amount), 0)

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onMove(chosen.map((i) => ({ id: i.tx.id, ...i.to })))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui mover.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Reorganizar cartão</h2>
            <p className="text-xs text-slate-400">
              Compras no cartão ainda não pagas que estão num mês diferente da data da compra.
              Desmarque o que quiser deixar onde está.
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs">
          <button
            className="text-slate-400 underline hover:text-slate-200"
            onClick={() =>
              setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.tx.id)))
            }
          >
            {selected.size === items.length ? 'desmarcar todos' : 'marcar todos'}
          </button>
          <span className="text-slate-400">
            {chosen.length} de {items.length} · {formatBRL(total)}
          </span>
        </div>

        <ul className="mb-4 divide-y divide-slate-800">
          {items.map(({ tx, to }) => (
            <li key={tx.id}>
              <label className="flex cursor-pointer items-center gap-2 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  checked={selected.has(tx.id)}
                  onChange={() => toggle(tx.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-200">{tx.description}</span>
                  <span className="text-[11px] text-slate-500">
                    compra {formatDate(tx.occurred_on)} · {label(tx.year, tx.month)} →{' '}
                    <span className="text-emerald-300">{label(to.year, to.month)}</span>
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-slate-300">{formatBRL(Number(tx.amount))}</span>
              </label>
            </li>
          ))}
        </ul>

        {error && <p className="mb-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
        <button
          className="btn-primary w-full"
          disabled={busy || chosen.length === 0}
          onClick={() => void submit()}
        >
          {busy ? 'Movendo…' : `Mover ${chosen.length} ${chosen.length === 1 ? 'lançamento' : 'lançamentos'}`}
        </button>
      </div>
    </div>
  )
}
