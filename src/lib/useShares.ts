import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadShares } from './shares'
import { loadFixedShares } from './fixedShares'
import { fixedAppliesToMonth } from './fixedExpense'
import type { FixedExpense, FixedShare, FixedShareStatus, Transaction, TxShare } from '../types'

/**
 * Partes que outras pessoas me devem: de lançamentos divididos e de gastos fixos divididos.
 * As de gasto fixo viram uma linha por mês, do mês inicial até `upToKey` (ano*12 + mês-1), com o "pago" de cada mês.
 */
export function useShares(
  userId: string,
  transactions: Transaction[],
  fixedExpenses: FixedExpense[],
  upToKey: number,
) {
  const [txShares, setTxShares] = useState<TxShare[]>([])
  const [fixedShares, setFixedShares] = useState<FixedShare[]>([])
  const [fixedStatus, setFixedStatus] = useState<FixedShareStatus[]>([])

  const reload = useCallback(async () => {
    try {
      setTxShares(await loadShares(userId))
    } catch {
      // tabela ainda não existe (schema não rodado): segue sem divisões
      setTxShares([])
    }
    try {
      const f = await loadFixedShares(userId)
      setFixedShares(f.shares)
      setFixedStatus(f.status)
    } catch {
      setFixedShares([])
      setFixedStatus([])
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload, transactions, fixedExpenses])

  // linhas mensais das partes de gastos fixos (mesmo formato das partes de lançamentos)
  const fixedRows = useMemo<TxShare[]>(() => {
    const rows: TxShare[] = []
    for (const fs of fixedShares) {
      const fixed = fixedExpenses.find((f) => f.id === fs.fixed_expense_id)
      if (!fixed || !fixed.active) continue
      for (let k = fs.since_year * 12 + (fs.since_month - 1); k <= upToKey; k++) {
        const y = Math.floor(k / 12)
        const m = (k % 12) + 1
        if (!fixedAppliesToMonth(fixed, y, m)) continue
        const st = fixedStatus.find((s) => s.fixed_share_id === fs.id && s.year === y && s.month === m)
        rows.push({
          id: `fixed:${fs.id}:${y}-${m}`,
          user_id: fs.user_id,
          transaction_id: fs.fixed_expense_id,
          person_name: fs.person_name,
          amount: Number(fs.amount),
          paid: st?.paid ?? false,
          paid_on: st?.paid_on ?? null,
          account_id: st?.account_id ?? null,
          description: `${fixed.name} (fixo)`,
          year: y,
          month: m,
          created_at: fs.created_at,
        })
      }
    }
    return rows
  }, [fixedShares, fixedStatus, fixedExpenses, upToKey])

  const shares = useMemo(() => [...txShares, ...fixedRows], [txShares, fixedRows])

  const byTx = useMemo(() => {
    const m = new Map<string, TxShare[]>()
    for (const s of txShares) m.set(s.transaction_id, [...(m.get(s.transaction_id) ?? []), s])
    return m
  }, [txShares])

  const byFixed = useMemo(() => {
    const m = new Map<string, FixedShare[]>()
    for (const s of fixedShares) m.set(s.fixed_expense_id, [...(m.get(s.fixed_expense_id) ?? []), s])
    return m
  }, [fixedShares])

  const people = useMemo(() => [...new Set(shares.map((s) => s.person_name))].sort(), [shares])

  return { shares, byTx, byFixed, people, reload }
}
