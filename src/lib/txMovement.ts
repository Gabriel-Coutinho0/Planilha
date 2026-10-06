import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { Transaction } from '../types'

/**
 * Mantém a retirada na conta bancária em sincronia com o lançamento: existe
 * uma retirada ligada a ele se (e só se) ele estiver pago e apontar pra uma conta.
 */
export async function syncTxMovement(userId: string, tx: Transaction): Promise<void> {
  const wanted = tx.paid && tx.debit_account_id != null
  const row = wanted
    ? {
        user_id: userId,
        account_id: tx.debit_account_id as string,
        amount: Number(tx.amount),
        kind: 'retirada' as const,
        occurred_on: (tx.paid_on ?? tx.occurred_on).slice(0, 10),
        note: tx.description,
        transaction_id: tx.id,
        transfer_id: null,
        income_id: null,
        source_key: null,
      }
    : null

  if (DEMO) {
    demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.transaction_id !== tx.id)
    if (row) {
      demoStore.savingsMovements.push({ ...row, id: demoId(), created_at: new Date().toISOString() })
    }
    return
  }

  const { error: delErr } = await supabase.from('savings_movements').delete().eq('transaction_id', tx.id)
  if (delErr) throw delErr
  if (row) {
    const { error } = await supabase.from('savings_movements').insert(row)
    if (error) throw error
  }
}
