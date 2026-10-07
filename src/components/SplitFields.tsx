import { formatBRL, parseAmount } from '../lib/format'
import { resolveSplit, type SplitRow } from '../lib/split'

interface Props {
  /** Valor do lançamento (por parcela, quando parcelado). */
  total: number
  rows: SplitRow[]
  onChange: (rows: SplitRow[]) => void
  knownPeople: string[]
  disabled?: boolean
}

/** "Dividir com": nome + valor de cada pessoa, com botão pra dividir igualmente. Mostra quanto sobra pra mim. */
export default function SplitFields({ total, rows, onChange, knownPeople, disabled }: Props) {
  const { mine, each, named } = resolveSplit(total, rows, parseAmount)
  const over = mine < -0.005

  function splitEqually() {
    const value = each.toFixed(2).replace('.', ',')
    onChange(rows.map((r) => (r.name.trim() ? { ...r, amount: value } : r)))
  }

  function setRow(i: number, patch: Partial<SplitRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  // colar "ana, bruno" num campo de nome vira uma linha por pessoa
  function setName(i: number, value: string) {
    if (!value.includes(',')) return setRow(i, { name: value })
    const names = value.split(',').map((n) => n.trim()).filter(Boolean)
    const next = rows.flatMap((r, idx) =>
      idx === i ? names.map((n, k) => ({ name: n, amount: k === 0 ? r.amount : '' })) : [r],
    )
    onChange(next)
  }

  if (rows.length === 0) {
    return (
      <button
        type="button"
        className="btn-ghost px-2.5 py-1 text-xs"
        disabled={disabled}
        onClick={() => onChange([{ name: '', amount: '' }])}
      >
        + dividir com outras pessoas
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400">Dividir com</p>
        <button type="button" className="text-[11px] text-slate-500 hover:text-slate-300" onClick={() => onChange([])}>
          remover divisão
        </button>
      </div>

      <datalist id="form-split-people">
        {knownPeople.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          return (
            <li key={i} className="flex items-center gap-2">
              <input
                className="input min-w-0 flex-1"
                list="form-split-people"
                placeholder="Nome da pessoa"
                value={r.name}
                onChange={(e) => setName(i, e.target.value)}
              />
              <div className="flex w-32 shrink-0 items-center rounded-lg border border-slate-700 bg-slate-950/60 focus-within:border-emerald-500">
                <span className="pl-2.5 text-xs text-slate-500">R$</span>
                <input
                  inputMode="decimal"
                  className="w-full bg-transparent px-2 py-2 text-right text-sm outline-none placeholder:text-slate-600"
                  placeholder="0,00"
                  value={r.amount}
                  onChange={(e) => setRow(i, { amount: e.target.value })}
                  aria-label={`Parte de ${r.name || 'pessoa'}`}
                />
              </div>
              <button
                type="button"
                className="btn-danger px-2 py-1 text-xs"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                title="Tirar esta pessoa"
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost px-2.5 py-1 text-xs"
            onClick={() => onChange([...rows, { name: '', amount: '' }])}
          >
            + pessoa
          </button>
          <button
            type="button"
            className="btn-ghost px-2.5 py-1 text-xs"
            disabled={named === 0 || total <= 0}
            onClick={splitEqually}
          >
            dividir igualmente (com você)
          </button>
        </div>
        <p className={`text-sm ${over ? 'text-rose-300' : 'text-slate-300'}`}>
          Minha parte: <span className="font-semibold tabular-nums">{formatBRL(Math.max(mine, 0))}</span>
          {over ? ' · as partes passam do total' : ''}
        </p>
      </div>
    </div>
  )
}
