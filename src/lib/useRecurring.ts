import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { RecurringExpense } from '../types'

export type RecurringInput = Omit<RecurringExpense, 'id' | 'user_id' | 'created_at'>

export interface RecurringData {
  items: RecurringExpense[]
  add: (r: RecurringInput) => Promise<void>
  update: (id: string, patch: Partial<RecurringInput>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useRecurring(userId: string): RecurringData {
  const [items, setItems] = useState<RecurringExpense[]>([])

  const reload = useCallback(async () => {
    if (DEMO) {
      setItems([...demoStore.recurring])
      return
    }
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    if (!error) setItems((data ?? []) as RecurringExpense[])
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    items,
    async add(r) {
      if (DEMO) {
        demoStore.recurring.push({
          ...r,
          id: demoId(),
          user_id: 'demo',
          created_at: new Date().toISOString(),
        })
        await reload()
        return
      }
      const { error } = await supabase.from('recurring_expenses').insert({ user_id: userId, ...r })
      if (error) throw error
      await reload()
    },
    async update(id, patch) {
      if (DEMO) {
        const it = demoStore.recurring.find((x) => x.id === id)
        if (it) Object.assign(it, patch)
        await reload()
        return
      }
      const { error } = await supabase.from('recurring_expenses').update(patch).eq('id', id)
      if (error) throw error
      await reload()
    },
    async remove(id) {
      if (DEMO) {
        demoStore.recurring = demoStore.recurring.filter((x) => x.id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
