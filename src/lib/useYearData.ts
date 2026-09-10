import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type {
  FixedExpense,
  MonthSummary,
  MonthlySalary,
  Transaction,
} from '../types'

interface YearData {
  loading: boolean
  error: string | null
  defaultSalary: number
  fixedExpenses: FixedExpense[]
  salaries: MonthlySalary[]
  transactions: Transaction[]
  summaries: MonthSummary[]
  annual: {
    salary: number
    spent: number
    remaining: number
    fixedMonthly: number
  }
  reload: () => Promise<void>
  setDefaultSalary: (value: number) => Promise<void>
  setMonthSalary: (month: number, value: number) => Promise<void>
  addFixed: (name: string, amount: number) => Promise<void>
  updateFixed: (id: string, patch: Partial<Pick<FixedExpense, 'name' | 'amount' | 'active'>>) => Promise<void>
  removeFixed: (id: string) => Promise<void>
  addTransaction: (t: { month: number; description: string; amount: number; occurred_on: string }) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
}

export function useYearData(userId: string, year: number): YearData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [defaultSalary, setDefault] = useState(0)
  const [fixedExpenses, setFixed] = useState<FixedExpense[]>([])
  const [salaries, setSalaries] = useState<MonthlySalary[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (DEMO) {
      setDefault(demoStore.defaultSalary)
      setFixed([...demoStore.fixedExpenses])
      setSalaries(demoStore.salaries.filter((s) => s.year === year))
      setTransactions(demoStore.transactions.filter((t) => t.year === year))
      setLoading(false)
      return
    }
    try {
      const [settings, fixed, sal, tx] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('fixed_expenses').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('monthly_salary').select('*').eq('user_id', userId).eq('year', year),
        supabase.from('transactions').select('*').eq('user_id', userId).eq('year', year).order('occurred_on'),
      ])
      const first = settings.error || fixed.error || sal.error || tx.error
      if (first) throw first
      setDefault(Number(settings.data?.default_salary ?? 0))
      setFixed((fixed.data ?? []) as FixedExpense[])
      setSalaries((sal.data ?? []) as MonthlySalary[])
      setTransactions((tx.data ?? []) as Transaction[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [userId, year])

  useEffect(() => {
    void reload()
  }, [reload])

  const summaries = useMemo<MonthSummary[]>(() => {
    const fixedMonthly = fixedExpenses
      .filter((f) => f.active)
      .reduce((s, f) => s + Number(f.amount), 0)
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const override = salaries.find((s) => s.month === month)
      const salary = override ? Number(override.salary) : defaultSalary
      const variableTotal = transactions
        .filter((t) => t.month === month)
        .reduce((s, t) => s + Number(t.amount), 0)
      const spent = fixedMonthly + variableTotal
      return {
        month,
        salary,
        fixedTotal: fixedMonthly,
        variableTotal,
        spent,
        remaining: salary - spent,
      }
    })
  }, [fixedExpenses, salaries, transactions, defaultSalary])

  const annual = useMemo(() => {
    const salary = summaries.reduce((s, m) => s + m.salary, 0)
    const spent = summaries.reduce((s, m) => s + m.spent, 0)
    return {
      salary,
      spent,
      remaining: salary - spent,
      fixedMonthly: summaries[0]?.fixedTotal ?? 0,
    }
  }, [summaries])

  return {
    loading,
    error,
    defaultSalary,
    fixedExpenses,
    salaries,
    transactions,
    summaries,
    annual,
    reload,
    async setDefaultSalary(value) {
      if (DEMO) {
        demoStore.defaultSalary = value
        setDefault(value)
        return
      }
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, default_salary: value, updated_at: new Date().toISOString() })
      if (error) throw error
      setDefault(value)
    },
    async setMonthSalary(month, value) {
      if (DEMO) {
        const found = demoStore.salaries.find((s) => s.year === year && s.month === month)
        if (found) found.salary = value
        else demoStore.salaries.push({ id: demoId(), user_id: 'demo', year, month, salary: value })
        await reload()
        return
      }
      const { error } = await supabase
        .from('monthly_salary')
        .upsert({ user_id: userId, year, month, salary: value }, { onConflict: 'user_id,year,month' })
      if (error) throw error
      await reload()
    },
    async addFixed(name, amount) {
      if (DEMO) {
        demoStore.fixedExpenses.push({
          id: demoId(), user_id: 'demo', name, amount, active: true, created_at: new Date().toISOString(),
        })
        await reload()
        return
      }
      const { error } = await supabase
        .from('fixed_expenses')
        .insert({ user_id: userId, name, amount, active: true })
      if (error) throw error
      await reload()
    },
    async updateFixed(id, patch) {
      if (DEMO) {
        const it = demoStore.fixedExpenses.find((f) => f.id === id)
        if (it) Object.assign(it, patch)
        await reload()
        return
      }
      const { error } = await supabase.from('fixed_expenses').update(patch).eq('id', id)
      if (error) throw error
      await reload()
    },
    async removeFixed(id) {
      if (DEMO) {
        demoStore.fixedExpenses = demoStore.fixedExpenses.filter((f) => f.id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
    async addTransaction(t) {
      if (DEMO) {
        demoStore.transactions.push({
          id: demoId(), user_id: 'demo', year, month: t.month,
          description: t.description, amount: t.amount, occurred_on: t.occurred_on,
          created_at: new Date().toISOString(),
        })
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        year,
        month: t.month,
        description: t.description,
        amount: t.amount,
        occurred_on: t.occurred_on,
      })
      if (error) throw error
      await reload()
    },
    async removeTransaction(id) {
      if (DEMO) {
        demoStore.transactions = demoStore.transactions.filter((t) => t.id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
