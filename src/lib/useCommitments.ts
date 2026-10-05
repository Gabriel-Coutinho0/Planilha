import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoStore } from './demoStore'

export interface CommittedRow {
  year: number
  month: number
  amount: number
  group_id: string | null
}

/**
 * Lançamentos do mês corrente em diante (qualquer ano): parcelas e contas já assumidas.
 * `refreshKeys` mudam quando os lançamentos mudam.
 */
export function useCommitments(userId: string, refreshKeys: unknown[]): CommittedRow[] {
  const [rows, setRows] = useState<CommittedRow[]>([])
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (DEMO) {
        const list = demoStore.transactions
          .filter((t) => t.year > y || (t.year === y && t.month >= m))
          .map((t) => ({ year: t.year, month: t.month, amount: Number(t.amount), group_id: t.group_id }))
        if (!cancelled) setRows(list)
        return
      }
      const { data, error } = await supabase
        .from('transactions')
        .select('year, month, amount, group_id')
        .eq('user_id', userId)
        .or(`year.gt.${y},and(year.eq.${y},month.gte.${m})`)
      if (!cancelled && !error) {
        setRows(
          (data ?? []).map((r) => ({
            year: r.year as number,
            month: r.month as number,
            amount: Number(r.amount),
            group_id: (r.group_id as string | null) ?? null,
          })),
        )
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, y, m, ...refreshKeys])

  return rows
}
