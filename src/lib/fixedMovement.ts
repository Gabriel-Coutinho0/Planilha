import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { FixedExpense } from '../types'

export const fixedSourceKey = (fixedId: string, year: number, month: number) => `fixed:${fixedId}:${year}-${month}`

/**
 * Mantém a retirada na conta em sincronia com o pagamento de um gasto fixo num mês: existe uma
 * retirada ligada a ele se (e só se) ele estiver pago e tiver sido pago com uma conta.
 */
export async function syncFixedMovement(
  userId: string,
  fixed: FixedExpense,
  year: number,
  month: number,
  paid: boolean,
  accountId: string | null,
  paidOn: string | null,
): Promise<void> {
  const key = fixedSourceKey(fixed.id, year, month)
  const row =
    paid && accountId && Number(fixed.amount) > 0
      ? {
          user_id: userId,
          account_id: accountId,
          amount: Number(fixed.amount),
          kind: 'retirada' as const,
          occurred_on: (paidOn ?? new Date().toISOString()).slice(0, 10),
          note: fixed.name,
          transaction_id: null,
          transfer_id: null,
          income_id: null,
          source_key: key,
        }
      : null

  if (DEMO) {
    demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.source_key !== key)
    if (row) {
      demoStore.savingsMovements.push({ ...row, id: demoId(), created_at: new Date().toISOString() })
    }
    return
  }

  const { error: delErr } = await supabase.from('savings_movements').delete().eq('source_key', key)
  if (delErr) throw delErr
  if (row) {
    const { error } = await supabase.from('savings_movements').insert(row)
    if (error) throw error
  }
}
