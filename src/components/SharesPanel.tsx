import { useMemo, useState } from 'react'
import type { SavingsAccount, TxShare } from '../types'
import { MONTHS_SHORT, formatBRL, formatDate } from '../lib/format'

interface Props {
  shares: TxShare[]
  /** Contas bancárias (onde o dinheiro pode cair). */
  accounts: SavingsAccount[]
  onSetPaid: (share: TxShare, paid: boolean, accountId: string | null) => Promise<void>
}

/** Quem me deve o quê de gastos divididos, com um "pagou" por parte. */
export default function SharesPanel({ shares, accounts, onSetPaid }: Props) {
  const [accountId, setAccountId] = useState('')
  const [showPaid, setShowPaid] = useState(false)

  const groups = useMemo(() => {
    const map = new Map<string, TxShare[]>()
    for (const s of shares) map.set(s.person_name, [...(map.get(s.person_name) ?? []), s])
    return [...map.entries()]
      .map(([name, list]) => {
        const open = list.filter((s) => !s.paid)
        return {
          name,
          owed: open.reduce((t, s) => t + Number(s.amount), 0),
          open,
          done: list.filter((s) => s.paid),
        }
      })
      .filter((g) => g.open.length > 0 || (showPaid && g.done.length > 0))
      .sort((a, b) => b.owed - a.owed)
  }, [shares, showPaid])

  if (shares.length === 0) return null
  const totalOwed = shares.filter((s) => !s.paid).reduce((t, s) => t + Number(s.amount), 0)
  const hasPaid = shares.some((s) => s.paid)

  return (
    <section id="pessoas-me-devem" className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Pessoas me devem</h3>
          <p className="text-xs text-slate-500">Partes de gastos divididos. Marque quando a pessoa pagar.</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-emerald-300">{formatBRL(totalOwed)}</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {accounts.length > 0 && (
          <label className="flex items-center gap-1.5">
            Receber na conta
            <select className="input py-1 text-xs" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Só marcar (não mexe em conta)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasPaid && (
          <label className="ml-auto flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-500"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
            />
            mostrar já recebidos
          </label>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">Ninguém te deve nada agora. 🎉</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.name} className="rounded-lg border border-slate-800 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">{g.name}</span>
                {g.owed > 0 && <span className="text-sm tabular-nums text-emerald-300">deve {formatBRL(g.owed)}</span>}
              </div>
              <ul className="divide-y divide-slate-800/70">
                {[...g.open, ...(showPaid ? g.done : [])].map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-emerald-500"
                      checked={s.paid}
                      onChange={(e) => void onSetPaid(s, e.target.checked, accountId || null)}
                      title={s.paid ? 'Já pagou (desmarcar devolve o valor)' : 'Marcar que pagou'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${s.paid ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                        {s.description}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {MONTHS_SHORT[s.month - 1]}/{s.year}
                        {s.paid && s.paid_on ? ` · recebido em ${formatDate(s.paid_on)}` : ''}
                        {s.paid && s.account_id
                          ? ` · caiu em ${accounts.find((a) => a.id === s.account_id)?.name ?? 'conta'}`
                          : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 tabular-nums ${s.paid ? 'text-slate-500' : 'text-slate-200'}`}>
                      {formatBRL(Number(s.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

