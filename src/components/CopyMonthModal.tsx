import { useEffect, useMemo, useState } from 'react'
import type { Transaction } from '../types'
import { MONTHS, formatBRL, formatDate } from '../lib/format'

interface Props {
  fromYear: number
  fromMonth: number
  toYear: number
  toMonth: number
  load: () => Promise<Transaction[]>
  onCopy: (rows: Transaction[]) => Promise<number>
  onDone: (count: number) => void
  onClose: () => void
}

export default function CopyMonthModal({
  fromYear,
  fromMonth,
  toYear,
  toMonth,
  load,
  onCopy,
  onDone,
  onClose,
}: Props) {
  const [rows, setRows] = useState<Transaction[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    load()
      .then((all) => {
        if (cancelled) return
        // parcelas não se copiam: elas já existem nos meses seguintes
        const usable = all.filter((t) => !t.group_id)
        setRows(usable)
        setSelected(new Set(usable.map((t) => t.id)))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Não consegui carregar o mês.'))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chosen = useMemo(() => (rows ?? []).filter((t) => selected.has(t.id)), [rows, selected])
  const total = chosen.reduce((s, t) => s + Number(t.amount), 0)

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
      const n = await onCopy(chosen)
      onDone(n)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui copiar.')
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
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Copiar do mês anterior</h2>
            <p className="text-xs text-slate-400">
              De {MONTHS[fromMonth - 1]} {fromYear} para {MONTHS[toMonth - 1]} {toYear}. Contas com
              vencimento voltam como "a pagar".
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        {rows == null ? (
          <p className="py-6 text-center text-xs text-slate-500">{error ?? 'Carregando…'}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Não há lançamentos avulsos em {MONTHS[fromMonth - 1]} pra copiar.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-xs">
              <button
                className="text-slate-400 underline hover:text-slate-200"
                onClick={() =>
                  setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((t) => t.id)))
                }
              >
                {selected.size === rows.length ? 'desmarcar todos' : 'marcar todos'}
              </button>
              <span className="text-slate-400">
                {chosen.length} de {rows.length} · {formatBRL(total)}
              </span>
            </div>
            <ul className="mb-4 divide-y divide-slate-800">
              {rows.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-500"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-200">
                      {t.description}
                      <span className="ml-1.5 text-[11px] text-slate-500">
                        {formatDate(t.due_date ?? t.occurred_on)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-300">
                      {formatBRL(Number(t.amount))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && rows != null && (
          <p className="mb-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
        )}
        <button
          className="btn-primary w-full"
          disabled={busy || chosen.length === 0}
          onClick={() => void submit()}
        >
          {busy ? 'Copiando…' : `Copiar ${chosen.length} lançamentos`}
        </button>
      </div>
    </div>
  )
}
