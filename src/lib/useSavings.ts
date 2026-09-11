import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { MovementKind, SavingsAccount, SavingsKind, SavingsMovement } from '../types'

export interface SavingsData {
  loading: boolean
  error: string | null
  accounts: SavingsAccount[]
  movements: SavingsMovement[]
  /** Saldo atual de cada conta (depósitos − retiradas). */
  balanceOf: (accountId: string) => number
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
  }) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  setIncludeInPatrimony: (id: string, value: boolean) => Promise<void>
  addMovement: (m: {
    account_id: string
    amount: number
    kind: MovementKind
    occurred_on: string
    note?: string | null
  }) => Promise<void>
  removeMovement: (id: string) => Promise<void>
}

export function useSavings(userId: string): SavingsData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [movements, setMovements] = useState<SavingsMovement[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (DEMO) {
      setAccounts([...demoStore.savingsAccounts])
      setMovements([...demoStore.savingsMovements])
      setLoading(false)
      return
    }
    try {
      const [acc, mov] = await Promise.all([
        supabase.from('savings_accounts').select('*').eq('user_id', userId).order('created_at'),
        supabase
          .from('savings_movements')
          .select('*')
          .eq('user_id', userId)
          .order('occurred_on', { ascending: false }),
      ])
      if (acc.error) throw acc.error
      if (mov.error) throw mov.error
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
  }, [reload])

  const balanceOf = useCallback(
    (accountId: string) =>
      movements
        .filter((m) => m.account_id === accountId)
        .reduce((s, m) => s + (m.kind === 'deposito' ? Number(m.amount) : -Number(m.amount)), 0),
    [movements],
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
    totals,
    patrimonyTotals,
    reload,
    async addAccount(a) {
      const accountRow = {
        user_id: DEMO ? 'demo' : userId,
        name: a.name,
        kind: a.kind,
        institution: a.institution ?? null,
        include_in_patrimony: a.includeInPatrimony ?? true,
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
        demoStore.savingsMovements.push({ ...row, id: demoId(), created_at: new Date().toISOString() })
        await reload()
        return
      }
      const { error } = await supabase.from('savings_movements').insert(row)
      if (error) throw error
      await reload()
    },
    async removeMovement(id) {
      if (DEMO) {
        demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('savings_movements').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
