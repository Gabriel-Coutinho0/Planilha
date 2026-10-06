import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadShares } from './shares'
import type { Transaction, TxShare } from '../types'

/** Partes de lançamentos que outras pessoas me devem. Recarrega quando os lançamentos mudam. */
export function useShares(userId: string, transactions: Transaction[]) {
  const [shares, setShares] = useState<TxShare[]>([])

  const reload = useCallback(async () => {
    try {
      setShares(await loadShares(userId))
    } catch {
      // tabela ainda não existe (schema não rodado): segue sem divisões
      setShares([])
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload, transactions])

  const byTx = useMemo(() => {
    const m = new Map<string, TxShare[]>()
    for (const s of shares) m.set(s.transaction_id, [...(m.get(s.transaction_id) ?? []), s])
    return m
  }, [shares])

  const people = useMemo(() => [...new Set(shares.map((s) => s.person_name))].sort(), [shares])

  return { shares, byTx, people, reload }
}
