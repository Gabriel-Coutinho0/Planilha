import { useCallback, useEffect, useState } from 'react'
import { useCategories } from './categories'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { CategoryRule } from '../types'

export type RuleInput = Pick<CategoryRule, 'keyword' | 'category' | 'method' | 'bank'>

export interface RulesData {
  rules: CategoryRule[]
  /** Cria ou atualiza (mesma palavra-chave) uma regra. */
  save: (r: RuleInput) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useRules(userId: string): RulesData {
  const [rules, setRules] = useState<CategoryRule[]>([])

  const reload = useCallback(async () => {
    if (DEMO) {
      setRules([...demoStore.rules])
      return
    }
    const { data, error } = await supabase
      .from('category_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    if (!error) setRules((data ?? []) as CategoryRule[])
  }, [userId])

  // renomear/apagar categoria muda o texto salvo aqui: recarrega
  const { version } = useCategories()
  useEffect(() => {
    void reload()
  }, [reload, version])

  return {
    rules,
    async save(r) {
      const keyword = r.keyword.trim().toLowerCase()
      if (!keyword) return
      if (DEMO) {
        const found = demoStore.rules.find((x) => x.keyword === keyword)
        if (found) Object.assign(found, { ...r, keyword })
        else
          demoStore.rules.push({
            ...r,
            keyword,
            id: demoId(),
            user_id: 'demo',
            created_at: new Date().toISOString(),
          })
        await reload()
        return
      }
      const { error } = await supabase
        .from('category_rules')
        .upsert({ user_id: userId, ...r, keyword }, { onConflict: 'user_id,keyword' })
      if (error) throw error
      await reload()
    },
    async remove(id) {
      if (DEMO) {
        demoStore.rules = demoStore.rules.filter((x) => x.id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('category_rules').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
