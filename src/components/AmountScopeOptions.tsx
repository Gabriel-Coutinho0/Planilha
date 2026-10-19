import type { AmountScope } from '../lib/fixedChanges'

interface Props {
  value: AmountScope
  onChange: (v: AmountScope) => void
  /** Mês em que a mudança começa, ex: "10/2026". */
  monthLabel: string
}

/** Escolha de até quando vale o novo valor de um gasto fixo. */
export default function AmountScopeOptions({ value, onChange, monthLabel }: Props) {
  const opts: { v: AmountScope; label: string; hint: string }[] = [
    { v: 'only', label: `Só em ${monthLabel}`, hint: 'o mês seguinte volta ao valor de antes' },
    { v: 'from', label: `De ${monthLabel} em diante`, hint: 'os meses anteriores ficam como estavam' },
    { v: 'all', label: 'Todos os meses', hint: 'corrige o valor também nos meses anteriores' },
  ]
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-[11px] text-slate-400">Valor novo vale:</legend>
      {opts.map((o) => (
        <label key={o.v} className="flex cursor-pointer items-start gap-2 text-xs text-slate-200">
          <input
            type="radio"
            name="amount-scope"
            className="mt-0.5 accent-emerald-500"
            checked={value === o.v}
            onChange={() => onChange(o.v)}
          />
          <span>
            {o.label} <span className="text-slate-500">· {o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
