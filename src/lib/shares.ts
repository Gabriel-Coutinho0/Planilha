import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { Transaction, TxShare } from '../types'
import { equalShares } from './split'

export interface SplitPerson {
  name: string
  amount: number
}

/** Divisão igual entre eu e as pessoas citadas (cada uma paga a mesma parte). */
export function equalPeople(total: number, names: string[]): SplitPerson[] {
  const clean = names.map((n) => n.trim()).filter(Boolean)
  const { each } = equalShares(total, clean.length)
  return clean.map((name) => ({ name, amount: each }))
}

const round2 = (n: number) => Math.round(n * 100) / 100
const shareKey = (id: string) => `share:${id}`

/** Mantém o depósito na conta em sincronia: existe se (e só se) a parte estiver paga numa conta. */
async function syncShareMovement(userId: string, s: TxShare): Promise<void> {
  const key = shareKey(s.id)
  const row =
    s.paid && s.account_id && Number(s.amount) > 0
      ? {
          user_id: userId,
          account_id: s.account_id,
          amount: Number(s.amount),
          kind: 'deposito' as const,
          occurred_on: (s.paid_on ?? new Date().toISOString()).slice(0, 10),
          note: `${s.person_name} · ${s.description}`,
          transaction_id: null,
          transfer_id: null,
          income_id: null,
          source_key: key,
        }
      : null
  if (DEMO) {
    demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.source_key !== key)
    if (row) demoStore.savingsMovements.push({ ...row, id: demoId(), created_at: new Date().toISOString() })
    return
  }
  const { error: delErr } = await supabase.from('savings_movements').delete().eq('source_key', key)
  if (delErr) throw delErr
  if (row) {
    const { error } = await supabase.from('savings_movements').insert(row)
    if (error) throw error
  }
}

export async function loadShares(userId: string): Promise<TxShare[]> {
  if (DEMO) return [...demoStore.shares]
  const { data, error } = await supabase
    .from('transaction_shares')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as TxShare[]
}

async function sharesOf(txIds: string[]): Promise<TxShare[]> {
  if (txIds.length === 0) return []
  if (DEMO) return demoStore.shares.filter((s) => txIds.includes(s.transaction_id))
  const { data, error } = await supabase.from('transaction_shares').select('*').in('transaction_id', txIds)
  if (error) throw error
  return (data ?? []) as TxShare[]
}

async function deleteShares(userId: string, list: TxShare[]): Promise<void> {
  if (list.length === 0) return
  const ids = list.map((s) => s.id)
  if (DEMO) {
    demoStore.shares = demoStore.shares.filter((s) => !ids.includes(s.id))
    demoStore.savingsMovements = demoStore.savingsMovements.filter(
      (m) => !m.source_key || !ids.some((i) => m.source_key === shareKey(i)),
    )
    return
  }
  const m = await supabase
    .from('savings_movements')
    .delete()
    .eq('user_id', userId)
    .in('source_key', ids.map(shareKey))
  if (m.error) throw m.error
  const { error } = await supabase.from('transaction_shares').delete().in('id', ids)
  if (error) throw error
}

async function setMyAmount(txId: string, myAmount: number | null): Promise<void> {
  if (DEMO) {
    const t = demoStore.transactions.find((x) => x.id === txId)
    if (t) t.my_amount = myAmount
    return
  }
  const { error } = await supabase.from('transactions').update({ my_amount: myAmount }).eq('id', txId)
  if (error) throw error
}

/**
 * Define com quem cada lançamento foi dividido. `people` vale pro lançamento `base`; nos outros
 * (parcelas) os valores são proporcionais ao valor de cada um. Quem já tinha pago mantém o "pago".
 * Lista vazia remove a divisão.
 */
export async function applySplit(
  userId: string,
  txs: Transaction[],
  base: Pick<Transaction, 'amount'>,
  people: SplitPerson[],
): Promise<void> {
  const clean = people.filter((p) => p.name.trim() && p.amount > 0)
  const old = await sharesOf(txs.map((t) => t.id))
  await deleteShares(userId, old)
  for (const tx of txs) {
    if (clean.length === 0) {
      await setMyAmount(tx.id, null)
      continue
    }
    const ratio = Number(tx.amount) / Number(base.amount || 1)
    const rows = clean.map((p) => {
      const before = old.find((o) => o.transaction_id === tx.id && o.person_name === p.name.trim())
      return {
        user_id: DEMO ? 'demo' : userId,
        transaction_id: tx.id,
        person_name: p.name.trim(),
        amount: round2(p.amount * ratio),
        paid: before?.paid ?? false,
        paid_on: before?.paid_on ?? null,
        account_id: before?.account_id ?? null,
        description: tx.description,
        year: tx.year,
        month: tx.month,
      }
    })
    const total = rows.reduce((s, r) => s + r.amount, 0)
    await setMyAmount(tx.id, Math.max(0, round2(Number(tx.amount) - total)))
    let created: TxShare[]
    if (DEMO) {
      created = rows.map((r) => ({ ...r, id: demoId(), created_at: new Date().toISOString() }))
      demoStore.shares.push(...created)
    } else {
      const { data, error } = await supabase.from('transaction_shares').insert(rows).select('*')
      if (error) throw error
      created = (data ?? []) as TxShare[]
    }
    for (const s of created) if (s.paid) await syncShareMovement(userId, s)
  }
}

/** Todas as parcelas do mesmo parcelamento (de qualquer ano). */
export async function groupTransactions(userId: string, groupId: string): Promise<Transaction[]> {
  if (DEMO) return demoStore.transactions.filter((t) => t.group_id === groupId)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []) as Transaction[]
}

/** Marca/desmarca que a pessoa pagou; com conta, o valor entra no saldo dela. */
export async function setSharePaid(
  userId: string,
  share: TxShare,
  paid: boolean,
  accountId: string | null,
  paidOn: string,
): Promise<void> {
  const patch = { paid, paid_on: paid ? paidOn : null, account_id: paid ? accountId : null }
  if (DEMO) {
    const s = demoStore.shares.find((x) => x.id === share.id)
    if (s) {
      Object.assign(s, patch)
      await syncShareMovement('demo', s)
    }
    return
  }
  const { error } = await supabase.from('transaction_shares').update(patch).eq('id', share.id)
  if (error) throw error
  await syncShareMovement(userId, { ...share, ...patch })
}

/** Antes de apagar lançamentos: tira os depósitos das partes pagas (as partes somem em cascata). */
export async function clearSharesForTx(userId: string, txIds: string[]): Promise<void> {
  await deleteShares(userId, await sharesOf(txIds))
}

/** Valor do lançamento mudou: as partes das pessoas acompanham na mesma proporção. Devolve a minha parte nova. */
export async function rescaleShares(userId: string, tx: Transaction, newAmount: number): Promise<number> {
  const list = await sharesOf([tx.id])
  const ratio = newAmount / Number(tx.amount || 1)
  let total = 0
  for (const s of list) {
    const amount = round2(Number(s.amount) * ratio)
    total += amount
    if (DEMO) {
      const d = demoStore.shares.find((x) => x.id === s.id)
      if (d) d.amount = amount
    } else {
      const { error } = await supabase.from('transaction_shares').update({ amount }).eq('id', s.id)
      if (error) throw error
    }
    if (s.paid) await syncShareMovement(userId, { ...s, amount })
  }
  return Math.max(0, round2(newAmount - total))
}
