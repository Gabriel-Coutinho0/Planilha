import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import { todayISO } from './format'
import { estimatedBalance } from './yield'
import type { MovementKind, SavingsAccount, SavingsKind, SavingsMovement } from '../types'

export interface SavingsData {
  loading: boolean
  error: string | null
  accounts: SavingsAccount[]
  movements: SavingsMovement[]
  /** Saldo atual de cada conta (depósitos − retiradas + rendimento estimado, se tiver % do CDI). */
  balanceOf: (accountId: string) => number
  /** Quanto a conta já rendeu (estimado): saldo atual − o que foi depositado líquido. */
  yieldOf: (accountId: string) => number
  /** CDI atual em % ao ano (base do rendimento estimado). */
  cdiRate: number
  setCdiRate: (value: number) => Promise<void>
  setCdiPercent: (id: string, value: number | null) => Promise<void>
  /** Meta da caixinha: valor a juntar e data limite (YYYY-MM-DD). null limpa. */
  setGoal: (id: string, amount: number | null, date: string | null) => Promise<void>
  /** Move dinheiro entre duas contas/caixinhas (retirada + depósito ligados). */
  transfer: (t: {
    from: string
    to: string
    amount: number
    occurred_on: string
    note?: string | null
  }) => Promise<void>
  totals: { contas: number; caixinhas: number; investimentos: number; total: number }
  /** Soma dos saldos das contas marcadas pra entrar no cartão "Patrimônio". */
  patrimonyTotals: { contas: number; caixinhas: number; investimentos: number }
  reload: () => Promise<void>
  addAccount: (a: {
    name: string
    kind: SavingsKind
    institution?: string | null
    initialAmount?: number
    includeInPatrimony?: boolean
    cdiPercent?: number | null
  }) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  setIncludeInPatrimony: (id: string, value: boolean) => Promise<void>
  addMovement: (m: {
    account_id: string
    amount: number
    kind: MovementKind
    occurred_on: string
    note?: string | null
  }) => Promise<string>
  removeMovement: (id: string) => Promise<void>
  /** Meta da reserva de emergência, em meses de gastos fixos. */
  emergencyMonths: number
  setEmergencyMonths: (value: number) => Promise<void>
}

/** `refreshKey` muda quando os lançamentos mudam (eles geram retiradas), pra recarregar os saldos. */
export function useSavings(userId: string, refreshKey?: unknown): SavingsData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [movements, setMovements] = useState<SavingsMovement[]>([])
  const [cdiRate, setCdiRateState] = useState(14.9)
  const [emergencyMonths, setEmergencyMonthsState] = useState(6)

  const reload = useCallback(async () => {
    setError(null)
    if (DEMO) {
      setAccounts([...demoStore.savingsAccounts])
      setMovements([...demoStore.savingsMovements])
      setCdiRateState(demoStore.cdiRate)
      setEmergencyMonthsState(demoStore.emergencyMonths)
      setLoading(false)
      return
    }
    try {
      const [acc, mov, settings] = await Promise.all([
        supabase.from('savings_accounts').select('*').eq('user_id', userId).order('created_at'),
        supabase
          .from('savings_movements')
          .select('*')
          .eq('user_id', userId)
          .order('occurred_on', { ascending: false }),
        supabase
          .from('user_settings')
          .select('cdi_rate, emergency_months')
          .eq('user_id', userId)
          .maybeSingle(),
      ])
      if (acc.error) throw acc.error
      if (mov.error) throw mov.error
      if (settings.error) throw settings.error
      setCdiRateState(Number(settings.data?.cdi_rate ?? 14.9))
      setEmergencyMonthsState(Number(settings.data?.emergency_months ?? 6))
      setAccounts((acc.data ?? []) as SavingsAccount[])
      setMovements((mov.data ?? []) as SavingsMovement[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar caixinhas e investimentos.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  const calc = useCallback(
    (accountId: string) =>
      estimatedBalance(
        movements.filter((m) => m.account_id === accountId),
        cdiRate,
        accounts.find((a) => a.id === accountId)?.cdi_percent ?? null,
        todayISO(),
      ),
    [movements, accounts, cdiRate],
  )
  const balanceOf = useCallback((accountId: string) => calc(accountId).balance, [calc])
  const yieldOf = useCallback(
    (accountId: string) => {
      const c = calc(accountId)
      return c.balance - c.principal
    },
    [calc],
  )

  const totals = useMemo(() => {
    let contas = 0
    let caixinhas = 0
    let investimentos = 0
    for (const a of accounts) {
      const bal = balanceOf(a.id)
      if (a.kind === 'conta') contas += bal
      else if (a.kind === 'caixinha') caixinhas += bal
      else investimentos += bal
    }
    return { contas, caixinhas, investimentos, total: contas + caixinhas + investimentos }
  }, [accounts, balanceOf])

  const patrimonyTotals = useMemo(() => {
    let contas = 0
    let caixinhas = 0
    let investimentos = 0
    for (const a of accounts) {
      if (!a.include_in_patrimony) continue
      const bal = balanceOf(a.id)
      if (a.kind === 'conta') contas += bal
      else if (a.kind === 'caixinha') caixinhas += bal
      else investimentos += bal
    }
    return { contas, caixinhas, investimentos }
  }, [accounts, balanceOf])

  return {
    loading,
    error,
    accounts,
    movements,
    balanceOf,
    yieldOf,
    cdiRate,
    totals,
    patrimonyTotals,
    reload,
    emergencyMonths,
    async setEmergencyMonths(value) {
      if (DEMO) {
        demoStore.emergencyMonths = value
        setEmergencyMonthsState(value)
        return
      }
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, emergency_months: value, updated_at: new Date().toISOString() })
      if (error) throw error
      setEmergencyMonthsState(value)
    },
    async setCdiRate(value) {
      if (DEMO) {
        demoStore.cdiRate = value
        setCdiRateState(value)
        return
      }
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, cdi_rate: value, updated_at: new Date().toISOString() })
      if (error) throw error
      setCdiRateState(value)
    },
    async setGoal(id, amount, date) {
      const patch = { goal_amount: amount, goal_date: amount ? date : null }
      if (DEMO) {
        const it = demoStore.savingsAccounts.find((a) => a.id === id)
        if (it) Object.assign(it, patch)
        await reload()
        return
      }
      const { error } = await supabase.from('savings_accounts').update(patch).eq('id', id)
      if (error) throw error
      await reload()
    },
    async transfer(t) {
      const fromName = accounts.find((a) => a.id === t.from)?.name ?? ''
      const toName = accounts.find((a) => a.id === t.to)?.name ?? ''
      const transferId = crypto.randomUUID()
      const common = {
        user_id: DEMO ? 'demo' : userId,
        amount: t.amount,
        occurred_on: t.occurred_on,
        transaction_id: null,
        transfer_id: transferId,
        income_id: null,
      }
      const out = {
        ...common,
        account_id: t.from,
        kind: 'retirada' as const,
        note: t.note?.trim() || `Transferência para ${toName}`,
      }
      const inn = {
        ...common,
        account_id: t.to,
        kind: 'deposito' as const,
        note: t.note?.trim() || `Transferência de ${fromName}`,
      }
      if (DEMO) {
        const created_at = new Date().toISOString()
        demoStore.savingsMovements.push({ ...out, id: demoId(), created_at })
        demoStore.savingsMovements.push({ ...inn, id: demoId(), created_at })
        await reload()
        return
      }
      const { error } = await supabase.from('savings_movements').insert([out, inn])
      if (error) throw error
      await reload()
    },
    async setCdiPercent(id, value) {
      if (DEMO) {
        const it = demoStore.savingsAccounts.find((a) => a.id === id)
        if (it) it.cdi_percent = value
        await reload()
        return
      }
      const { error } = await supabase.from('savings_accounts').update({ cdi_percent: value }).eq('id', id)
      if (error) throw error
      await reload()
    },
    async addAccount(a) {
      const accountRow = {
        user_id: DEMO ? 'demo' : userId,
        name: a.name,
        kind: a.kind,
        institution: a.institution ?? null,
        goal_amount: null,
        goal_date: null,
        include_in_patrimony: a.includeInPatrimony ?? true,
        cdi_percent: a.cdiPercent ?? null,
      }
      if (DEMO) {
        const id = demoId()
        demoStore.savingsAccounts.push({ ...accountRow, id, created_at: new Date().toISOString() })
        if (a.initialAmount && a.initialAmount > 0) {
          demoStore.savingsMovements.push({
            id: demoId(),
            user_id: 'demo',
            account_id: id,
            amount: a.initialAmount,
            kind: 'deposito',
            occurred_on: new Date().toISOString().slice(0, 10),
            note: 'Saldo inicial',
            transaction_id: null,
            transfer_id: null,
            income_id: null,
            created_at: new Date().toISOString(),
          })
        }
        await reload()
        return
      }
      const { data, error } = await supabase
        .from('savings_accounts')
        .insert(accountRow)
        .select('id')
        .single()
      if (error) throw error
      if (a.initialAmount && a.initialAmount > 0 && data) {
        const { error: mErr } = await supabase.from('savings_movements').insert({
          user_id: userId,
          account_id: data.id,
          amount: a.initialAmount,
          kind: 'deposito',
          occurred_on: new Date().toISOString().slice(0, 10),
          note: 'Saldo inicial',
        })
        if (mErr) throw mErr
      }
      await reload()
    },
    async removeAccount(id) {
      if (DEMO) {
        demoStore.savingsAccounts = demoStore.savingsAccounts.filter((a) => a.id !== id)
        demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.account_id !== id)
        for (const t of demoStore.transactions) if (t.debit_account_id === id) t.debit_account_id = null
        await reload()
        return
      }
      const { error } = await supabase.from('savings_accounts').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
    async setIncludeInPatrimony(id, value) {
      if (DEMO) {
        const it = demoStore.savingsAccounts.find((a) => a.id === id)
        if (it) it.include_in_patrimony = value
        await reload()
        return
      }
      const { error } = await supabase
        .from('savings_accounts')
        .update({ include_in_patrimony: value })
        .eq('id', id)
      if (error) throw error
      await reload()
    },
    async addMovement(m) {
      const row = {
        user_id: DEMO ? 'demo' : userId,
        account_id: m.account_id,
        amount: m.amount,
        kind: m.kind,
        occurred_on: m.occurred_on,
        note: m.note ?? null,
      }
      if (DEMO) {
        const id = demoId()
        demoStore.savingsMovements.push({ ...row, transaction_id: null, transfer_id: null, income_id: null, id, created_at: new Date().toISOString() })
        await reload()
        return id
      }
      const { data, error } = await supabase.from('savings_movements').insert(row).select('id').single()
      if (error) throw error
      await reload()
      return (data as { id: string }).id
    },
    async removeMovement(id) {
      // transferência: apaga as duas pontas juntas
      const transferId = movements.find((m) => m.id === id)?.transfer_id ?? null
      if (DEMO) {
        demoStore.savingsMovements = demoStore.savingsMovements.filter((m) =>
          transferId ? m.transfer_id !== transferId : m.id !== id,
        )
        await reload()
        return
      }
      const q = supabase.from('savings_movements').delete()
      const { error } = transferId ? await q.eq('transfer_id', transferId) : await q.eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
