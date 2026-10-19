import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoStore } from './demoStore'
import { fixedAt } from './fixedExpense'
import { loadFixedShares } from './fixedShares'
import type { FixedChange, FixedExpense } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100
const keyOf = (y: number, m: number) => y * 12 + m

/** Até quando vale a mudança de valor: só neste mês, deste mês em diante, ou todos os meses (corrige o valor base). */
export type AmountScope = 'only' | 'from' | 'all'

export async function loadFixedChanges(userId: string): Promise<FixedChange[]> {
  if (DEMO) return [...demoStore.fixedChanges]
  const { data, error } = await supabase.from('fixed_amount_changes').select('*').eq('user_id', userId)
  // tabela ainda não existe (schema não rodado): segue sem reajustes
  if (error) return []
  return (data ?? []) as FixedChange[]
}

/** Junta os reajustes a cada gasto fixo. */
export function withChanges(list: FixedExpense[], changes: FixedChange[]): FixedExpense[] {
  return list.map((f) => ({ ...f, changes: changes.filter((c) => c.fixed_expense_id === f.id) }))
}

async function upsertChange(userId: string, c: FixedChange): Promise<void> {
  if (DEMO) {
    demoStore.fixedChanges = demoStore.fixedChanges.filter(
      (x) => !(x.fixed_expense_id === c.fixed_expense_id && x.from_year === c.from_year && x.from_month === c.from_month),
    )
    demoStore.fixedChanges.push({ ...c })
    return
  }
  const { error } = await supabase
    .from('fixed_amount_changes')
    .upsert({ user_id: userId, ...c }, { onConflict: 'fixed_expense_id,from_year,from_month' })
  if (error) throw error
}

async function deleteChangesFrom(userId: string, fixedId: string, fromKey: number): Promise<void> {
  if (DEMO) {
    demoStore.fixedChanges = demoStore.fixedChanges.filter(
      (c) => c.fixed_expense_id !== fixedId || keyOf(c.from_year, c.from_month) < fromKey,
    )
    return
  }
  const { data, error } = await supabase
    .from('fixed_amount_changes')
    .select('id, from_year, from_month')
    .eq('user_id', userId)
    .eq('fixed_expense_id', fixedId)
  if (error) throw error
  const ids = (data ?? []).filter((c) => keyOf(c.from_year, c.from_month) >= fromKey).map((c) => c.id as string)
  if (ids.length === 0) return
  const del = await supabase.from('fixed_amount_changes').delete().in('id', ids)
  if (del.error) throw del.error
}

/**
 * Muda o valor do gasto fixo sem mexer nos meses anteriores.
 * Devolve os meses (ano*12+mês) afetados: do mês escolhido até o último que muda (ou null se vale para sempre).
 */
export async function changeFixedAmount(
  userId: string,
  fixed: FixedExpense,
  amount: number,
  year: number,
  month: number,
  scope: AmountScope,
): Promise<{ fromKey: number; toKey: number | null }> {
  // quem divide o gasto continua pagando o mesmo; a diferença fica na minha parte
  const { shares } = await loadFixedShares(userId)
  const sharedTotal = shares.filter((s) => s.fixed_expense_id === fixed.id).reduce((s, x) => s + Number(x.amount), 0)
  const mine = sharedTotal > 0 ? Math.max(0, round2(amount - sharedTotal)) : null

  if (scope === 'all') {
    if (DEMO) {
      const it = demoStore.fixedExpenses.find((f) => f.id === fixed.id)
      if (it) {
        it.amount = amount
        it.my_amount = mine
      }
    } else {
      const { error } = await supabase.from('fixed_expenses').update({ amount, my_amount: mine }).eq('id', fixed.id)
      if (error) throw error
    }
    await deleteChangesFrom(userId, fixed.id, -Infinity)
    return { fromKey: -Infinity, toKey: null }
  }

  const here = keyOf(year, month)
  if (scope === 'from') {
    await deleteChangesFrom(userId, fixed.id, here)
    await upsertChange(userId, { fixed_expense_id: fixed.id, from_year: year, from_month: month, amount, my_amount: mine })
    return { fromKey: here, toKey: null }
  }

  // só este mês: o mês seguinte volta ao valor que valia antes (a não ser que ele já tenha reajuste próprio)
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const nextHasChange = (fixed.changes ?? []).some((c) => c.from_year === ny && c.from_month === nm)
  const restore = fixedAt(fixed, ny, nm)
  await upsertChange(userId, { fixed_expense_id: fixed.id, from_year: year, from_month: month, amount, my_amount: mine })
  if (!nextHasChange) {
    await upsertChange(userId, {
      fixed_expense_id: fixed.id,
      from_year: ny,
      from_month: nm,
      amount: Number(restore.amount),
      my_amount: restore.my_amount ?? null,
    })
  }
  return { fromKey: here, toKey: here }
}

/** Antes de apagar o gasto fixo (no banco os reajustes somem em cascata). */
export async function clearFixedChanges(fixedId: string): Promise<void> {
  if (DEMO) demoStore.fixedChanges = demoStore.fixedChanges.filter((c) => c.fixed_expense_id !== fixedId)
}

/** Divisão do gasto fixo mudou: refaz "minha parte" de cada reajuste (as pessoas pagam o mesmo, a diferença é minha). */
export async function refreshChangeMyAmounts(userId: string, fixedId: string): Promise<void> {
  const { shares } = await loadFixedShares(userId)
  const total = shares.filter((s) => s.fixed_expense_id === fixedId).reduce((s, x) => s + Number(x.amount), 0)
  const changes = (await loadFixedChanges(userId)).filter((c) => c.fixed_expense_id === fixedId)
  for (const c of changes) {
    await upsertChange(userId, { ...c, my_amount: total > 0 ? Math.max(0, round2(Number(c.amount) - total)) : null })
  }
}
