import { formatBRL } from '../lib/format'

interface Props {
  year: number
  contas: number
  caixinhas: number
  investimentos: number
  remaining: number
}

function Item({ label, value }: { label: string; value: number }) {
  return (
    <span className="whitespace-nowrap">
      {label}{' '}
      <span className={`font-semibold ${value >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
        {formatBRL(value)}
      </span>
    </span>
  )
}

export default function PatrimonyCard({ year, contas, caixinhas, investimentos, remaining }: Props) {
  const total = contas + caixinhas + investimentos + remaining

  return (
    <div className="card border-emerald-900/40 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Patrimônio — saldo atual + sobra prevista de {year}
      </p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {formatBRL(total)}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <Item label="Em conta" value={contas} />
        <Item label="Guardado" value={caixinhas} />
        <Item label="Investido" value={investimentos} />
        <Item label={`Sobra ${year}`} value={remaining} />
      </div>
    </div>
  )
}
