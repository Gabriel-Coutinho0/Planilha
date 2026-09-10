import { formatBRL } from '../lib/format'

interface Props {
  label: string
  value: number
  tone?: 'neutral' | 'auto' | 'emerald' | 'rose'
  hint?: string
}

export default function StatCard({ label, value, tone = 'neutral', hint }: Props) {
  const color =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'rose'
        ? 'text-rose-400'
        : tone === 'auto'
          ? value >= 0
            ? 'text-emerald-400'
            : 'text-rose-400'
          : 'text-slate-100'

  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${color}`}>{formatBRL(value)}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}
