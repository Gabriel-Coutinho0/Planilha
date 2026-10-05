import { formatBRL } from '../lib/format'

interface Props {
  /** Saldo das caixinhas que contam no patrimônio. */
  saved: number
  /** Gastos fixos por mês. */
  fixedMonthly: number
  targetMonths: number
  onSetTarget: (months: number) => void
}

export default function EmergencyCard({ saved, fixedMonthly, targetMonths, onSetTarget }: Props) {
  const covered = fixedMonthly > 0 ? saved / fixedMonthly : null
  const pct = covered != null ? Math.min(100, (covered / targetMonths) * 100) : 0
  const goal = fixedMonthly * targetMonths
  const missing = Math.max(0, goal - saved)
  const reached = covered != null && covered >= targetMonths
  const tone = reached ? 'bg-emerald-400' : covered != null && covered >= targetMonths / 2 ? 'bg-amber-400' : 'bg-rose-400'

  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Reserva de emergência</h3>
          <p className="text-[11px] text-slate-500">
            Quantos meses de gastos fixos suas caixinhas cobrem
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
          meta
          <input
            type="number"
            min={1}
            max={36}
            className="input w-16 py-1 text-[11px]"
            defaultValue={targetMonths}
            onBlur={(e) => {
              const v = Math.min(36, Math.max(1, Math.round(Number(e.target.value) || targetMonths)))
              if (v !== targetMonths) onSetTarget(v)
            }}
          />
          meses
        </label>
      </div>

      {covered == null ? (
        <p className="py-2 text-xs text-slate-400">
          Cadastre seus gastos fixos pra calcular quantos meses a reserva cobre.
        </p>
      ) : (
        <>
          <p className="text-2xl font-bold tabular-nums text-slate-100">
            {covered.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{' '}
            <span className="text-sm font-medium text-slate-400">
              {covered === 1 ? 'mês' : 'meses'} de gastos fixos
            </span>
          </p>
          <div className="my-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-slate-400">
            {reached
              ? `🎯 Meta de ${targetMonths} meses batida (${formatBRL(saved)} guardados).`
              : `Faltam ${formatBRL(missing)} pra chegar a ${targetMonths} meses (${formatBRL(goal)}). Guardado: ${formatBRL(saved)}.`}
          </p>
        </>
      )}
    </div>
  )
}
