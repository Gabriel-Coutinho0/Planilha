import { formatBRL } from '../lib/format'

interface Alert {
  key: string
  tone: 'rose' | 'amber'
  text: string
  href?: string
  onClick?: () => void
}

interface Props {
  overdueCount: number
  overdueTotal: number
  currentMonthRemaining: number | null
  lowBalanceAlert: number
}

const TONE_STYLE: Record<Alert['tone'], string> = {
  rose: 'border-rose-800 bg-rose-950/40 text-rose-100',
  amber: 'border-amber-800 bg-amber-950/30 text-amber-100',
}

export default function AlertsCard({
  overdueCount,
  overdueTotal,
  currentMonthRemaining,
  lowBalanceAlert,
}: Props) {
  const alerts: Alert[] = []

  if (overdueCount > 0) {
    alerts.push({
      key: 'overdue',
      tone: 'rose',
      text: `⚠️ ${overdueCount} ${overdueCount === 1 ? 'conta atrasada' : 'contas atrasadas'} — ${formatBRL(overdueTotal)}`,
      href: '#contas-a-pagar',
    })
  }

  if (currentMonthRemaining != null && currentMonthRemaining < 0) {
    alerts.push({
      key: 'negative',
      tone: 'rose',
      text: `📉 Mês atual no vermelho — sobra ${formatBRL(currentMonthRemaining)}`,
    })
  } else if (currentMonthRemaining != null && currentMonthRemaining < lowBalanceAlert) {
    alerts.push({
      key: 'low',
      tone: 'amber',
      text: `🟡 Sobra do mês atual está baixa — ${formatBRL(currentMonthRemaining)}`,
    })
  }

  return (
    <div className="card p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Avisos</p>
      {alerts.length === 0 ? (
        <p className="text-sm text-slate-400">Tudo em dia 🎉</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) =>
            a.href ? (
              <a
                key={a.key}
                href={a.href}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition hover:brightness-110 ${TONE_STYLE[a.tone]}`}
              >
                <span className="font-medium">{a.text}</span>
                <span className="shrink-0 text-xs underline opacity-80">ver</span>
              </a>
            ) : (
              <div
                key={a.key}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${TONE_STYLE[a.tone]}`}
              >
                {a.text}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
