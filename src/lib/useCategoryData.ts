import { useCallback, useEffect } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import {
  DEFAULT_CATEGORIES,
  defaultCategoryList,
  setCategories,
  useCategories,
  type Category,
} from './categories'

export interface CategoryInput {
  name: string
  color: string
  icon: string
}

/** Tabelas que guardam a categoria como texto (renomear/apagar precisa atualizar todas). */
const TEXT_TABLES = ['transactions', 'fixed_expenses', 'recurring_expenses', 'category_rules'] as const

/**
 * Carrega as categorias do usuário (criando as padrão na primeira vez) e oferece
 * criar/editar/apagar. Renomear e apagar atualizam tudo que usa a categoria.
 */
export function useCategoryData(userId: string, onChanged: () => void) {
  const { list } = useCategories()

  const load = useCallback(async () => {
    if (DEMO) {
      setCategories([...demoStore.categories])
      return
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('position')
    if (error) {
      // tabela ainda não existe (schema não rodado): segue com as categorias padrão
      setCategories(defaultCategoryList())
      return
    }
    if ((data ?? []).length === 0) {
      const rows = DEFAULT_CATEGORIES.map((c, i) => ({ user_id: userId, position: i, ...c }))
      const ins = await supabase.from('categories').insert(rows).select('*')
      setCategories(ins.error ? defaultCategoryList() : ((ins.data ?? []) as Category[]))
      return
    }
    setCategories(data as Category[])
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  function assertName(name: string, exceptId?: string) {
    const n = name.trim()
    if (!n) throw new Error('Dê um nome para a categoria.')
    if (list.some((c) => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase())) {
      throw new Error(`Já existe uma categoria "${n}".`)
    }
    return n
  }

  async function persist(next: Category[], bump: boolean) {
    setCategories(next, bump)
    if (DEMO) demoStore.categories = next
  }

  /** Muda o texto da categoria em tudo que a usa (null = deixa sem categoria). */
  async function cascade(from: string, to: string | null) {
    if (DEMO) {
      for (const t of demoStore.transactions) if (t.category === from) t.category = to
      for (const f of demoStore.fixedExpenses) if (f.category === from) f.category = to
      for (const r of demoStore.recurring) if (r.category === from) r.category = to
      for (const r of demoStore.rules) if (r.category === from) r.category = to
      if (to == null || demoStore.budgets.some((b) => b.category === to)) {
        demoStore.budgets = demoStore.budgets.filter((b) => b.category !== from)
      } else {
        for (const b of demoStore.budgets) if (b.category === from) b.category = to
      }
      return
    }
    for (const table of TEXT_TABLES) {
      const { error } = await supabase.from(table).update({ category: to }).eq('user_id', userId).eq('category', from)
      if (error) throw error
    }
    if (to == null) {
      const { error } = await supabase.from('category_budgets').delete().eq('user_id', userId).eq('category', from)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('category_budgets')
        .update({ category: to })
        .eq('user_id', userId)
        .eq('category', from)
      if (error) {
        // já havia orçamento na categoria de destino: descarta o da antiga
        await supabase.from('category_budgets').delete().eq('user_id', userId).eq('category', from)
      }
    }
  }

  return {
    reload: load,
    async add(input: CategoryInput) {
      const name = assertName(input.name)
      const position = list.reduce((m, c) => Math.max(m, c.position), -1) + 1
      if (DEMO) {
        await persist([...list, { id: demoId(), name, color: input.color, icon: input.icon, position }], false)
        return
      }
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: userId, name, color: input.color, icon: input.icon, position })
        .select('*')
        .single()
      if (error) throw error
      await persist([...list, data as Category], false)
    },
    async update(id: string, patch: Partial<CategoryInput>) {
      const cur = list.find((c) => c.id === id)
      if (!cur) return
      const name = patch.name !== undefined ? assertName(patch.name, id) : cur.name
      const renamed = name !== cur.name
      const next = { ...cur, ...patch, name }
      if (!DEMO) {
        const { error } = await supabase
          .from('categories')
          .update({ name, color: next.color, icon: next.icon })
          .eq('id', id)
        if (error) throw error
      }
      if (renamed) await cascade(cur.name, name)
      await persist(list.map((c) => (c.id === id ? next : c)), renamed)
      if (renamed) onChanged()
    },
    /** Apaga a categoria; o que a usava vai pra `moveTo` (ou fica sem categoria). */
    async remove(id: string, moveTo: string | null) {
      const cur = list.find((c) => c.id === id)
      if (!cur) return
      await cascade(cur.name, moveTo)
      if (!DEMO) {
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (error) throw error
      }
      await persist(list.filter((c) => c.id !== id), true)
      onChanged()
    },
    /** Quantos lançamentos, fixos, recorrentes e regras usam a categoria. */
    async usageOf(name: string): Promise<number> {
      if (DEMO) {
        return (
          demoStore.transactions.filter((t) => t.category === name).length +
          demoStore.fixedExpenses.filter((f) => f.category === name).length +
          demoStore.recurring.filter((r) => r.category === name).length +
          demoStore.rules.filter((r) => r.category === name).length
        )
      }
      let total = 0
      for (const table of TEXT_TABLES) {
        const { count } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('category', name)
        total += count ?? 0
      }
      return total
    },
  }
}

export type CategoryData = ReturnType<typeof useCategoryData>
