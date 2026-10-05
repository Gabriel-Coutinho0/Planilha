import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoStore } from './demoStore'

interface Row {
  id: string
  description: string
  amount: number
  paid: boolean
  due_date: string | null
  occurred_on: string
  group_id: string
  card_id: string | null
}

export interface InstallmentPlan {
  groupId: string
  name: string
  total: number
  paid: number
  remainingCount: number
  perInstallment: number
  remainingAmount: number
  /** Próximo vencimento ainda não pago. */
  nextDue: string | null
  /** Vencimento da última parcela. */
  lastDue: string
  cardId: string | null
}

const baseName = (d: string) => d.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim()

/** Parcelamentos de todos os anos, agrupados; só devolve os que ainda têm parcela por pagar. */
export function useInstallments(userId: string, refreshKeys: unknown[]) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (DEMO) {
        const list = demoStore.transactions
          .filter((t) => t.group_id)
          .map((t) => ({ ...t, group_id: t.group_id as string }))
        if (!cancelled) setRows(list)
        return
      }
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, paid, due_date, occurred_on, group_id, card_id')
        .eq('user_id', userId)
        .not('group_id', 'is', null)
      if (!cancelled && !error) setRows((data ?? []) as Row[])
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ...refreshKeys])

  return useMemo<InstallmentPlan[]>(() => {
    const groups = new Map<string, Row[]>()
    for (const r of rows) {
      const arr = groups.get(r.group_id)
      if (arr) arr.push(r)
      else groups.set(r.group_id, [r])
    }
    const plans: InstallmentPlan[] = []
    for (const [groupId, list] of groups) {
      const dueOf = (r: Row) => (r.due_date ?? r.occurred_on).slice(0, 10)
      const unpaid = list.filter((r) => !r.paid).sort((a, b) => dueOf(a).localeCompare(dueOf(b)))
      if (unpaid.length === 0) continue
      const dues = list.map(dueOf).sort()
      plans.push({
        groupId,
        name: baseName(list[0].description),
        total: list.length,
        paid: list.length - unpaid.length,
        remainingCount: unpaid.length,
        perInstallment: Number(list[0].amount),
        remainingAmount: unpaid.reduce((s, r) => s + Number(r.amount), 0),
        nextDue: dueOf(unpaid[0]),
        lastDue: dues[dues.length - 1],
        cardId: list[0].card_id,
      })
    }
    return plans.sort((a, b) => (a.nextDue ?? '').localeCompare(b.nextDue ?? ''))
  }, [rows])
}
