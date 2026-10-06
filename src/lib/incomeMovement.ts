import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { ExtraIncome } from '../types'

/**
 * Mantém o depósito na conta em sincronia com a receita: existe um depósito ligado a ela
 * se (e só se) ela estiver recebida e tiver conta de destino.
 */
export async function syncIncomeMovement(userId: string, inc: ExtraIncome): Promise<void> {
  const wanted = inc.received && inc.account_id != null && Number(inc.amount) > 0
  const row = wanted
    ? {
        user_id: userId,
        account_id: inc.account_id as string,
        amount: Number(inc.amount),
        kind: 'deposito' as const,
        occurred_on: (inc.received_on ?? new Date().toISOString()).slice(0, 10),
        note: inc.description,
        transaction_id: null,
        transfer_id: null,
        income_id: inc.id,
      }
    : null

  if (DEMO) {
    demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.income_id !== inc.id)
    if (row) {
      demoStore.savingsMovements.push({ ...row, id: demoId(), created_at: new Date().toISOString() })
    }
    return
  }

  const { error: delErr } = await supabase.from('savings_movements').delete().eq('income_id', inc.id)
  if (delErr) throw delErr
  if (row) {
    const { error } = await supabase.from('savings_movements').insert(row)
    if (error) throw error
  }
}
