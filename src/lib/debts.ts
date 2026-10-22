import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import { setSharePaid } from './shares'
import { todayISO } from './format'
import type { Debt, DebtSettlement, SettlementItem, Transaction, TxShare } from '../types'

const round2 = (n: number) => Math.round(n * 100) / 100
const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (r: { year: number; month: number }) => r.year * 12 + r.month
const debtKey = (id: string) => `debt:${id}`

export async function loadDebts(userId: string): Promise<Debt[]> {
  if (DEMO) return [...demoStore.debts]
  const { data, error } = await supabase.from('debts').select('*').eq('user_id', userId).order('created_at')
  // tabela ainda não existe (schema não rodado): segue sem dívidas
  if (error) return []
  return (data ?? []) as Debt[]
}

export async function loadSettlements(userId: string): Promise<DebtSettlement[]> {
  if (DEMO) return [...demoStore.settlements]
  const { data, error } = await supabase
    .from('debt_settlements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as DebtSettlement[]
}

/** Mantém a retirada na conta: existe se (e só se) a dívida estiver paga numa conta. */
async function syncDebtMovement(userId: string, d: Debt): Promise<void> {
  const key = debtKey(d.id)
  const row =
    d.paid && d.account_id && Number(d.amount) > 0
      ? {
          user_id: userId,
          account_id: d.account_id,
          amount: Number(d.amount),
          kind: 'retirada' as const,
          occurred_on: (d.paid_on ?? new Date().toISOString()).slice(0, 10),
          note: `${d.person_name} · ${d.description}`,
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

export interface NewDebt {
  person: string
  description: string
  /** Valor total; é dividido igualmente entre as parcelas. */
  total: number
  count: number
  startYear: number
  startMonth: number
  /** purchase = compra no cartão de outra pessoa (conta como meu gasto); loan = empréstimo/dívida avulsa. */
  kind: 'purchase' | 'loan'
  category?: string | null
}

/**
 * Registra uma dívida (uma linha por parcela). Compra no cartão de outra pessoa também cria o gasto
 * em cada mês (já marcado como pago, sem sair de conta alguma): o dinheiro só sai quando eu pagar a dívida.
 */
export async function addDebt(userId: string, p: NewDebt): Promise<void> {
  const uid = DEMO ? 'demo' : userId
  const count = Math.max(1, Math.floor(p.count))
  const each = round2(p.total / count)
  const groupId = count > 1 ? crypto.randomUUID() : null
  const today = new Date()
  const day = Math.min(today.getDate(), 28)

  const parts = Array.from({ length: count }, (_, i) => {
    const offset = p.startMonth - 1 + i
    const y = p.startYear + Math.floor(offset / 12)
    const m = (offset % 12) + 1
    return {
      y,
      m,
      amount: i === count - 1 ? round2(p.total - each * (count - 1)) : each,
      description: count > 1 ? `${p.description} (${i + 1}/${count})` : p.description,
      date: `${y}-${pad(m)}-${pad(day)}`,
    }
  })

  let txIds: Array<string | null> = parts.map(() => null)
  if (p.kind === 'purchase') {
    const rows = parts.map((x) => ({
      user_id: uid,
      year: x.y,
      month: x.m,
      description: x.description,
      amount: x.amount,
      occurred_on: x.date,
      paid: true,
      paid_on: x.date,
      due_date: null,
      method: null,
      category: p.category ?? null,
      bank: `Cartão de ${p.person}`,
      note: null,
      group_id: groupId,
      card_id: null,
      debit_account_id: null,
      recurring_id: null,
    }))
    if (DEMO) {
      const made = rows.map((r) => ({ ...r, id: demoId(), created_at: new Date().toISOString() })) as Transaction[]
      demoStore.transactions.push(...made)
      txIds = made.map((t) => t.id)
    } else {
      const { data, error } = await supabase.from('transactions').insert(rows).select('id')
      if (error) throw error
      txIds = (data ?? []).map((t) => t.id as string)
    }
  }

  const debtRows = parts.map((x, i) => ({
    user_id: uid,
    person_name: p.person.trim(),
    amount: x.amount,
    description: x.description,
    year: x.y,
    month: x.m,
    paid: false,
    paid_on: null,
    account_id: null,
    transaction_id: txIds[i] ?? null,
    group_id: groupId,
  }))
  if (DEMO) {
    demoStore.debts.push(...debtRows.map((r) => ({ ...r, id: demoId(), created_at: new Date().toISOString() })))
    return
  }
  const { error } = await supabase.from('debts').insert(debtRows)
  if (error) throw error
}

/** Marca/desmarca que eu paguei; com conta, o valor sai do saldo dela. */
export async function setDebtPaid(
  userId: string,
  debt: Debt,
  paid: boolean,
  accountId: string | null,
  paidOn: string,
): Promise<void> {
  const patch = { paid, paid_on: paid ? paidOn : null, account_id: paid ? accountId : null }
  if (DEMO) {
    const d = demoStore.debts.find((x) => x.id === debt.id)
    if (d) {
      Object.assign(d, patch)
      await syncDebtMovement('demo', d)
    }
    return
  }
  const { error } = await supabase.from('debts').update(patch).eq('id', debt.id)
  if (error) throw error
  await syncDebtMovement(userId, { ...debt, ...patch })
}

/** Apaga a dívida (e o gasto ligado a ela, se foi compra no cartão de outra pessoa). */
export async function removeDebt(userId: string, debt: Debt): Promise<void> {
  if (DEMO) {
    demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.source_key !== debtKey(debt.id))
    demoStore.debts = demoStore.debts.filter((d) => d.id !== debt.id)
    if (debt.transaction_id) demoStore.transactions = demoStore.transactions.filter((t) => t.id !== debt.transaction_id)
    return
  }
  const m = await supabase.from('savings_movements').delete().eq('user_id', userId).eq('source_key', debtKey(debt.id))
  if (m.error) throw m.error
  const { error } = await supabase.from('debts').delete().eq('id', debt.id)
  if (error) throw error
  if (debt.transaction_id) {
    const t = await supabase.from('transactions').delete().eq('id', debt.transaction_id)
    if (t.error) throw t.error
  }
}

// ---------------------------------------------------------------- abatimento

export interface SettleRow {
  id: string
  amount: number
  take: number
}

export interface SettlePlan {
  amount: number
  shareRows: SettleRow[]
  debtRows: SettleRow[]
}

const isVirtual = (s: TxShare) => s.id.startsWith('fixed:')

function take<T extends { id: string; amount: number }>(
  list: T[],
  n: number,
  partialOk: (r: T) => boolean,
): SettleRow[] {
  const out: SettleRow[] = []
  let left = n
  for (const r of list) {
    if (left <= 0.004) break
    const a = Number(r.amount)
    if (a <= left + 0.004) {
      out.push({ id: r.id, amount: a, take: a })
      left = round2(left - a)
    } else if (partialOk(r)) {
      out.push({ id: r.id, amount: a, take: round2(left) })
      left = 0
    } else break
  }
  return out
}

const sumTake = (rows: SettleRow[]) => round2(rows.reduce((s, r) => s + r.take, 0))

/** Quanto dá pra abater com cada pessoa que está nas duas listas (o menor dos dois lados). */
export function settleOffers(shares: TxShare[], debts: Debt[]): Map<string, number> {
  const mine = new Map<string, number>()
  for (const s of shares) if (!s.paid) mine.set(s.person_name, (mine.get(s.person_name) ?? 0) + Number(s.amount))
  const out = new Map<string, number>()
  const theirs = new Map<string, number>()
  for (const d of debts) if (!d.paid) theirs.set(d.person_name, (theirs.get(d.person_name) ?? 0) + Number(d.amount))
  for (const [name, a] of mine) {
    const b = theirs.get(name)
    if (b) out.set(name, round2(Math.min(a, b)))
  }
  return out
}

/** Quais parcelas (as mais antigas primeiro) entram no abatimento com a pessoa. */
export function planSettlement(shares: TxShare[], debts: Debt[], person: string): SettlePlan {
  const sh = shares.filter((s) => s.person_name === person && !s.paid).sort((a, b) => keyOf(a) - keyOf(b))
  const db = debts.filter((d) => d.person_name === person && !d.paid).sort((a, b) => keyOf(a) - keyOf(b))
  const shMap = new Map(sh.map((s) => [s.id, s]))
  let n = round2(
    Math.min(
      sh.reduce((s, r) => s + Number(r.amount), 0),
      db.reduce((s, r) => s + Number(r.amount), 0),
    ),
  )
  let shareRows: SettleRow[] = []
  let debtRows: SettleRow[] = []
  // parte de gasto fixo não pode ser fatiada: se o corte cair nela, o abatimento encolhe até as duas pontas fecharem
  for (let i = 0; i < 8; i++) {
    shareRows = take(sh, n, (r) => !isVirtual(shMap.get(r.id)!))
    debtRows = take(db, n, () => true)
    const m = Math.min(sumTake(shareRows), sumTake(debtRows))
    if (Math.abs(m - n) < 0.005) break
    n = m
  }
  return { amount: n, shareRows, debtRows }
}

async function setShareAmount(shareId: string, amount: number): Promise<void> {
  if (DEMO) {
    const s = demoStore.shares.find((x) => x.id === shareId)
    if (s) s.amount = amount
    return
  }
  const { error } = await supabase.from('transaction_shares').update({ amount }).eq('id', shareId)
  if (error) throw error
}

async function setDebtAmount(debtId: string, amount: number): Promise<void> {
  if (DEMO) {
    const d = demoStore.debts.find((x) => x.id === debtId)
    if (d) d.amount = amount
    return
  }
  const { error } = await supabase.from('debts').update({ amount }).eq('id', debtId)
  if (error) throw error
}

/** Faz o encontro de contas com a pessoa: quita as parcelas mais antigas dos dois lados (sem mexer em conta). */
export async function applySettlement(
  userId: string,
  shares: TxShare[],
  debts: Debt[],
  person: string,
): Promise<number> {
  const plan = planSettlement(shares, debts, person)
  if (plan.amount <= 0) return 0
  const today = todayISO()
  const snapshot: SettlementItem[] = []
  for (const r of plan.shareRows) {
    const s = shares.find((x) => x.id === r.id)!
    snapshot.push({ kind: 'share', id: r.id, amount: r.amount })
    if (r.take >= r.amount - 0.004) await setSharePaid(userId, s, true, null, today)
    else await setShareAmount(r.id, round2(r.amount - r.take))
  }
  for (const r of plan.debtRows) {
    const d = debts.find((x) => x.id === r.id)!
    snapshot.push({ kind: 'debt', id: r.id, amount: r.amount })
    if (r.take >= r.amount - 0.004) await setDebtPaid(userId, d, true, null, today)
    else await setDebtAmount(r.id, round2(r.amount - r.take))
  }
  const row = {
    user_id: DEMO ? 'demo' : userId,
    person_name: person,
    amount: plan.amount,
    settled_on: today,
    snapshot,
  }
  if (DEMO) demoStore.settlements.unshift({ ...row, id: demoId(), created_at: new Date().toISOString() })
  else {
    const { error } = await supabase.from('debt_settlements').insert(row)
    if (error) throw error
  }
  return plan.amount
}

/** Desfaz um abatimento: as parcelas voltam ao valor e à situação de antes. */
export async function undoSettlement(
  userId: string,
  s: DebtSettlement,
  shares: TxShare[],
  debts: Debt[],
): Promise<void> {
  for (const it of s.snapshot) {
    if (it.kind === 'share') {
      const sh = shares.find((x) => x.id === it.id)
      if (!sh) continue
      if (isVirtual(sh)) {
        await setSharePaid(userId, sh, false, null, todayISO())
        continue
      }
      if (DEMO) {
        const d = demoStore.shares.find((x) => x.id === it.id)
        if (d) Object.assign(d, { amount: it.amount, paid: false, paid_on: null, account_id: null })
      } else {
        const { error } = await supabase
          .from('transaction_shares')
          .update({ amount: it.amount, paid: false, paid_on: null, account_id: null })
          .eq('id', it.id)
        if (error) throw error
      }
    } else {
      const d = debts.find((x) => x.id === it.id)
      if (!d) continue
      if (DEMO) {
        const x = demoStore.debts.find((y) => y.id === it.id)
        if (x) Object.assign(x, { amount: it.amount, paid: false, paid_on: null, account_id: null })
      } else {
        const { error } = await supabase
          .from('debts')
          .update({ amount: it.amount, paid: false, paid_on: null, account_id: null })
          .eq('id', it.id)
        if (error) throw error
      }
    }
  }
  if (DEMO) demoStore.settlements = demoStore.settlements.filter((x) => x.id !== s.id)
  else {
    const { error } = await supabase.from('debt_settlements').delete().eq('id', s.id)
    if (error) throw error
  }
}
