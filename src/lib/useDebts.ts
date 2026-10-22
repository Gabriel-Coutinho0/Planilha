import { useCallback, useEffect, useState } from 'react'
import { loadDebts, loadSettlements } from './debts'
import type { Debt, DebtSettlement } from '../types'

/** Dívidas minhas com pessoas e o histórico de abatimentos. */
export function useDebts(userId: string) {
  const [debts, setDebts] = useState<Debt[]>([])
  const [settlements, setSettlements] = useState<DebtSettlement[]>([])

  const reload = useCallback(async () => {
    setDebts(await loadDebts(userId))
    setSettlements(await loadSettlements(userId))
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { debts, settlements, reload }
}
