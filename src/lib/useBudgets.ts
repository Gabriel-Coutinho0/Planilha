import { useCallback, useEffect, useState } from 'react'
import { useCategories } from './categories'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { CategoryBudget } from '../types'

export interface BudgetsData {
  budgets: CategoryBudget[]
  /** Define o limite mensal de uma categoria; valor 0 remove. */
  setBudget: (category: string, amount: number) => Promise<void>
}

export function useBudgets(userId: string): BudgetsData {
  const [budgets, setBudgets] = useState<CategoryBudget[]>([])

  const reload = useCallback(async () => {
    if (DEMO) {
      setBudgets([...demoStore.budgets])
      return
    }
    const { data, error } = await supabase.from('category_budgets').select('*').eq('user_id', userId)
    if (!error) setBudgets((data ?? []) as CategoryBudget[])
  }, [userId])

  // renomear/apagar categoria muda o texto salvo aqui: recarrega
  const { version } = useCategories()
  useEffect(() => {
    void reload()
  }, [reload, version])

  return {
    budgets,
    async setBudget(category, amount) {
      if (DEMO) {
        demoStore.budgets = demoStore.budgets.filter((b) => b.category !== category)
        if (amount > 0)
          demoStore.budgets.push({ id: demoId(), user_id: 'demo', category, amount })
        await reload()
        return
      }
      if (amount > 0) {
        const { error } = await supabase
          .from('category_budgets')
          .upsert({ user_id: userId, category, amount }, { onConflict: 'user_id,category' })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('category_budgets')
          .delete()
          .eq('user_id', userId)
          .eq('category', category)
        if (error) throw error
      }
      await reload()
    },
  }
}
