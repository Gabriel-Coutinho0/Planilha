import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { FixedExpense, FixedShare, FixedShareStatus } from '../types'
import type { SplitPerson } from './shares'

const round2 = (n: number) => Math.round(n * 100) / 100
const moveKey = (shareId: string, year: number, month: number) => `fshare:${shareId}:${year}-${month}`

export async function loadFixedShares(
  userId: string,
): Promise<{ shares: FixedShare[]; status: FixedShareStatus[] }> {
  if (DEMO) return { shares: [...demoStore.fixedShares], status: [...demoStore.fixedShareStatus] }
  const [s, st] = await Promise.all([
    supabase.from('fixed_shares').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('fixed_share_status').select('*').eq('user_id', userId),
  ])
  if (s.error) throw s.error
  if (st.error) throw st.error
  return { shares: (s.data ?? []) as FixedShare[], status: (st.data ?? []) as FixedShareStatus[] }
}

/** Mantém o depósito na conta: existe se (e só se) a pessoa pagou aquele mês numa conta. */
async function syncMovement(
  userId: string,
  share: FixedShare,
  fixedName: string,
  year: number,
  month: number,
  paid: boolean,
  accountId: string | null,
  paidOn: string | null,
): Promise<void> {
  const key = moveKey(share.id, year, month)
  const row =
    paid && accountId && Number(share.amount) > 0
      ? {
          user_id: userId,
          account_id: accountId,
          amount: Number(share.amount),
          kind: 'deposito' as const,
          occurred_on: (paidOn ?? new Date().toISOString()).slice(0, 10),
          note: `${share.person_name} · ${fixedName}`,
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

/** Apaga depósitos de todos os meses dessas partes. */
async function deleteMovementsOf(userId: string, shareIds: string[]): Promise<void> {
  if (shareIds.length === 0) return
  if (DEMO) {
    demoStore.savingsMovements = demoStore.savingsMovements.filter(
      (m) => !m.source_key || !shareIds.some((id) => m.source_key!.startsWith(`fshare:${id}:`)),
    )
    return
  }
  for (const id of shareIds) {
    const { error } = await supabase
      .from('savings_movements')
      .delete()
      .eq('user_id', userId)
      .like('source_key', `fshare:${id}:%`)
    if (error) throw error
  }
}

async function setFixedMyAmount(fixedId: string, myAmount: number | null): Promise<void> {
  if (DEMO) {
    const f = demoStore.fixedExpenses.find((x) => x.id === fixedId)
    if (f) f.my_amount = myAmount
    return
  }
  const { error } = await supabase.from('fixed_expenses').update({ my_amount: myAmount }).eq('id', fixedId)
  if (error) throw error
}

/**
 * Define com quem o gasto fixo é dividido (valor fixo por pessoa, todo mês, a partir de `since`).
 * Quem continua na lista mantém o "pago" dos meses; quem saiu perde as partes e os depósitos.
 * Lista vazia remove a divisão.
 */
export async function applyFixedSplit(
  userId: string,
  fixed: Pick<FixedExpense, 'id' | 'amount'>,
  people: SplitPerson[],
  since: { year: number; month: number },
): Promise<void> {
  const clean = people.filter((p) => p.name.trim() && p.amount > 0)
  const { shares: all } = await loadFixedShares(userId)
  const old = all.filter((s) => s.fixed_expense_id === fixed.id)

  const keepNames = new Set(clean.map((p) => p.name.trim()))
  const gone = old.filter((s) => !keepNames.has(s.person_name))
  await deleteMovementsOf(userId, gone.map((s) => s.id))
  if (gone.length > 0) {
    if (DEMO) {
      const ids = new Set(gone.map((s) => s.id))
      demoStore.fixedShares = demoStore.fixedShares.filter((s) => !ids.has(s.id))
      demoStore.fixedShareStatus = demoStore.fixedShareStatus.filter((s) => !ids.has(s.fixed_share_id))
    } else {
      const { error } = await supabase.from('fixed_shares').delete().in('id', gone.map((s) => s.id))
      if (error) throw error
    }
  }

  for (const p of clean) {
    const name = p.name.trim()
    const existing = old.find((s) => s.person_name === name)
    if (existing) {
      if (Number(existing.amount) !== p.amount) {
        if (DEMO) {
          const d = demoStore.fixedShares.find((s) => s.id === existing.id)
          if (d) d.amount = p.amount
        } else {
          const { error } = await supabase.from('fixed_shares').update({ amount: p.amount }).eq('id', existing.id)
          if (error) throw error
        }
      }
    } else {
      const row = {
        user_id: DEMO ? 'demo' : userId,
        fixed_expense_id: fixed.id,
        person_name: name,
        amount: p.amount,
        since_year: since.year,
        since_month: since.month,
      }
      if (DEMO) {
        demoStore.fixedShares.push({ ...row, id: demoId(), created_at: new Date().toISOString() })
      } else {
        const { error } = await supabase.from('fixed_shares').insert(row)
        if (error) throw error
      }
    }
  }

  const total = clean.reduce((s, p) => s + p.amount, 0)
  await setFixedMyAmount(fixed.id, clean.length === 0 ? null : Math.max(0, round2(Number(fixed.amount) - total)))
}

/** Marca/desmarca que a pessoa pagou a parte de um mês; com conta, o valor entra no saldo dela. */
export async function setFixedSharePaid(
  userId: string,
  share: FixedShare,
  fixedName: string,
  year: number,
  month: number,
  paid: boolean,
  accountId: string | null,
  paidOn: string,
): Promise<void> {
  const row = {
    user_id: DEMO ? 'demo' : userId,
    fixed_share_id: share.id,
    year,
    month,
    paid,
    paid_on: paid ? paidOn : null,
    account_id: paid ? accountId : null,
  }
  if (DEMO) {
    const found = demoStore.fixedShareStatus.find(
      (s) => s.fixed_share_id === share.id && s.year === year && s.month === month,
    )
    if (found) Object.assign(found, row)
    else demoStore.fixedShareStatus.push(row)
  } else {
    const { error } = await supabase
      .from('fixed_share_status')
      .upsert(row, { onConflict: 'user_id,fixed_share_id,year,month' })
    if (error) throw error
  }
  await syncMovement(userId, share, fixedName, year, month, paid, row.account_id, row.paid_on)
}

/** Antes de apagar o gasto fixo: tira os depósitos das partes (as partes somem em cascata no banco). */
export async function clearFixedShares(userId: string, fixedId: string): Promise<void> {
  const { shares } = await loadFixedShares(userId)
  const mine = shares.filter((s) => s.fixed_expense_id === fixedId)
  await deleteMovementsOf(userId, mine.map((s) => s.id))
  if (DEMO) {
    const ids = new Set(mine.map((s) => s.id))
    demoStore.fixedShares = demoStore.fixedShares.filter((s) => !ids.has(s.id))
    demoStore.fixedShareStatus = demoStore.fixedShareStatus.filter((s) => !ids.has(s.fixed_share_id))
  }
}

/** Valor do gasto fixo mudou: as partes das pessoas acompanham na mesma proporção. Devolve a minha parte nova. */
export async function rescaleFixedShares(
  userId: string,
  fixed: Pick<FixedExpense, 'id' | 'amount'>,
  newAmount: number,
): Promise<number> {
  const { shares } = await loadFixedShares(userId)
  const list = shares.filter((s) => s.fixed_expense_id === fixed.id)
  const ratio = newAmount / Number(fixed.amount || 1)
  let total = 0
  for (const s of list) {
    const amount = round2(Number(s.amount) * ratio)
    total += amount
    if (DEMO) {
      const d = demoStore.fixedShares.find((x) => x.id === s.id)
      if (d) d.amount = amount
    } else {
      const { error } = await supabase.from('fixed_shares').update({ amount }).eq('id', s.id)
      if (error) throw error
    }
  }
  return Math.max(0, round2(newAmount - total))
}
