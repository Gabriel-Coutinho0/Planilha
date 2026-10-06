import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import { MONTHS_SHORT } from './format'
import { fixedAppliesToMonth } from './fixedExpense'
import { syncTxMovement } from './txMovement'
import { syncIncomeMovement } from './incomeMovement'
import { templateAppliesToMonth } from './incomes'
import type {
  ExtraIncome,
  FixedExpense,
  FixedExpenseStatus,
  IncomeTemplate,
  MonthSummary,
  MonthlySalary,
  PaymentMethod,
  Transaction,
} from '../types'

interface YearData {
  loading: boolean
  error: string | null
  defaultSalary: number
  lowBalanceAlert: number
  fixedExpenses: FixedExpense[]
  fixedStatus: FixedExpenseStatus[]
  salaries: MonthlySalary[]
  transactions: Transaction[]
  summaries: MonthSummary[]
  extraIncomes: ExtraIncome[]
  incomeTemplates: IncomeTemplate[]
  /** true quando há receitas fixas ativas: o salário padrão deixa de contar sozinho. */
  usingIncomeTemplates: boolean
  addIncome: (
    month: number,
    description: string,
    amount: number,
    opts?: {
      received?: boolean
      accountId?: string | null
      day?: number | null
      templateId?: string | null
    },
  ) => Promise<void>
  /** Atualiza uma receita lançada (marcar recebida, mudar valor/conta…). */
  updateIncome: (
    id: string,
    patch: Partial<Pick<ExtraIncome, 'description' | 'amount' | 'received' | 'received_on' | 'account_id' | 'day'>>,
  ) => Promise<void>
  removeIncome: (id: string) => Promise<void>
  addTemplate: (t: Omit<IncomeTemplate, 'id' | 'user_id' | 'created_at'>) => Promise<IncomeTemplate>
  updateTemplate: (
    id: string,
    patch: Partial<Omit<IncomeTemplate, 'id' | 'user_id' | 'created_at'>>,
  ) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  annual: {
    salary: number
    extra: number
    spent: number
    remaining: number
    fixedMonthly: number
  }
  reload: () => Promise<void>
  setDefaultSalary: (value: number) => Promise<void>
  setLowBalanceAlert: (value: number) => Promise<void>
  setMonthSalary: (month: number, value: number) => Promise<void>
  addFixed: (
    name: string,
    amount: number,
    extra?: {
      category?: string | null
      method?: PaymentMethod | null
      bank?: string | null
      note?: string | null
      startYear?: number | null
      startMonth?: number | null
      cardId?: string | null
    },
  ) => Promise<void>
  updateFixed: (
    id: string,
    patch: Partial<
      Pick<
        FixedExpense,
        | 'name'
        | 'amount'
        | 'active'
        | 'category'
        | 'method'
        | 'bank'
        | 'note'
        | 'start_year'
        | 'start_month'
        | 'card_id'
      >
    >,
  ) => Promise<void>
  removeFixed: (id: string) => Promise<void>
  isFixedPaid: (fixedExpenseId: string, month: number) => boolean
  setFixedPaid: (fixedExpenseId: string, month: number, paid: boolean) => Promise<void>
  addTransaction: (t: {
    month: number
    description: string
    amount: number
    occurred_on: string
    paid?: boolean
    due_date?: string | null
    method?: PaymentMethod | null
    category?: string | null
    bank?: string | null
    note?: string | null
    card_id?: string | null
    debit_account_id?: string | null
    recurring_id?: string | null
  }) => Promise<void>
  addInstallments: (p: {
    description: string
    count: number
    amount: number
    startYear: number
    startMonth: number
    day: number
    method?: PaymentMethod | null
    category?: string | null
    bank?: string | null
    note?: string | null
    cardId?: string | null
  }) => Promise<{ addedThisYear: number; addedNextYears: number }>
  setPaid: (id: string, paid: boolean) => Promise<void>
  /** Move o lançamento para o mês seguinte (uso manual em conta atrasada). */
  postponeTransaction: (id: string) => Promise<void>
  updateTransaction: (
    id: string,
    patch: Partial<
      Pick<
        Transaction,
        | 'description'
        | 'amount'
        | 'occurred_on'
        | 'due_date'
        | 'method'
        | 'paid'
        | 'category'
        | 'bank'
        | 'note'
        | 'card_id'
        | 'debit_account_id'
      >
    >,
  ) => Promise<void>
  /** Reinsere um lançamento removido (undo), mantendo o mesmo id. */
  restoreTransaction: (tx: Transaction) => Promise<void>
  /** Marca vários lançamentos (de qualquer ano) como pagos/não pagos de uma vez. */
  setPaidMany: (ids: string[], paid: boolean) => Promise<void>
  /** Lançamentos de um mês qualquer (inclusive de outro ano). */
  loadMonthTransactions: (year: number, month: number) => Promise<Transaction[]>
  /** Copia lançamentos para outro mês; devolve quantos foram criados. */
  copyTransactions: (rows: Transaction[], toYear: number, toMonth: number) => Promise<number>
  /** Insere vários lançamentos de uma vez (importação de fatura); devolve quantos. */
  importTransactions: (
    rows: Array<Omit<Transaction, 'id' | 'user_id' | 'created_at'>>,
  ) => Promise<number>
  /** Muda o ano/mês de vários lançamentos (cada um pro seu destino). */
  moveTransactions: (moves: Array<{ id: string; year: number; month: number }>) => Promise<void>
  /** Remove a transacao; se `groupId` vier, remove todas as parcelas do grupo. */
  removeTransaction: (id: string, groupId?: string | null) => Promise<number>
}

const pad = (n: number) => String(n).padStart(2, '0')

function nextMonth(y: number, m: number) {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
}

/** Mesmo dia do mes, mas no ano/mes destino (limitado ao ultimo dia do mes). */
function shiftDate(iso: string, toY: number, toM: number) {
  const day = Number(iso.slice(8, 10)) || 1
  const last = new Date(toY, toM, 0).getDate()
  return `${toY}-${pad(toM)}-${pad(Math.min(day, last))}`
}

/** Gera uma linha de transacao para cada parcela, avancando o mes (e o ano). */
function buildInstallmentRows(
  userId: string,
  p: {
    description: string
    count: number
    amount: number
    startYear: number
    startMonth: number
    day: number
    method?: PaymentMethod | null
    category?: string | null
    bank?: string | null
    note?: string | null
    cardId?: string | null
  },
) {
  const groupId = crypto.randomUUID()
  const rows: Array<Omit<Transaction, 'id' | 'created_at'>> = []
  for (let i = 0; i < p.count; i++) {
    const offset = p.startMonth - 1 + i
    const y = p.startYear + Math.floor(offset / 12)
    const m = (offset % 12) + 1
    const lastDay = new Date(y, m, 0).getDate()
    const d = Math.min(Math.max(1, p.day), lastDay)
    const date = `${y}-${pad(m)}-${pad(d)}`
    rows.push({
      user_id: userId,
      year: y,
      month: m,
      description: `${p.description} (${i + 1}/${p.count})`,
      amount: p.amount,
      occurred_on: date,
      paid: false,
      due_date: date,
      method: p.method ?? null,
      category: p.category ?? null,
      bank: p.bank ?? null,
      note: p.note ?? null,
      group_id: groupId,
      card_id: p.cardId ?? null,
      debit_account_id: null,
      recurring_id: null,
    })
  }
  return rows
}

export function useYearData(userId: string, year: number): YearData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [defaultSalary, setDefault] = useState(0)
  const [lowBalanceAlert, setLowBalance] = useState(300)
  const [fixedExpenses, setFixed] = useState<FixedExpense[]>([])
  const [fixedStatus, setFixedStatus] = useState<FixedExpenseStatus[]>([])
  const [salaries, setSalaries] = useState<MonthlySalary[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplate[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (DEMO) {
      setDefault(demoStore.defaultSalary)
      setLowBalance(demoStore.lowBalanceAlert)
      setFixed([...demoStore.fixedExpenses])
      setFixedStatus(demoStore.fixedStatus.filter((s) => s.year === year))
      setSalaries(demoStore.salaries.filter((s) => s.year === year))
      setTransactions(demoStore.transactions.filter((t) => t.year === year))
      setExtraIncomes(demoStore.extraIncomes.filter((i) => i.year === year))
      setIncomeTemplates([...demoStore.incomeTemplates])
      setLoading(false)
      return
    }
    try {
      const [settings, fixed, fixedSt, sal, tx, inc, tpl] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('fixed_expenses').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('fixed_expense_status').select('*').eq('user_id', userId).eq('year', year),
        supabase.from('monthly_salary').select('*').eq('user_id', userId).eq('year', year),
        supabase.from('transactions').select('*').eq('user_id', userId).eq('year', year).order('occurred_on'),
        supabase.from('extra_incomes').select('*').eq('user_id', userId).eq('year', year).order('created_at'),
        supabase.from('income_templates').select('*').eq('user_id', userId).order('created_at'),
      ])
      const first = settings.error || fixed.error || fixedSt.error || sal.error || tx.error || inc.error || tpl.error
      if (first) throw first
      setDefault(Number(settings.data?.default_salary ?? 0))
      setLowBalance(Number(settings.data?.low_balance_alert ?? 300))
      setFixed((fixed.data ?? []) as FixedExpense[])
      setFixedStatus((fixedSt.data ?? []) as FixedExpenseStatus[])
      setSalaries((sal.data ?? []) as MonthlySalary[])
      setTransactions((tx.data ?? []) as Transaction[])
      setExtraIncomes((inc.data ?? []) as ExtraIncome[])
      setIncomeTemplates((tpl.data ?? []) as IncomeTemplate[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [userId, year])

  const isFixedPaid = useCallback(
    (fixedExpenseId: string, month: number) =>
      fixedStatus.find((s) => s.fixed_expense_id === fixedExpenseId && s.month === month)?.paid ??
      false,
    [fixedStatus],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  const usingTemplates = incomeTemplates.some((t) => t.active)

  const summaries = useMemo<MonthSummary[]>(() => {
    const now = new Date()
    // Gasto fixo só conta como "a pagar" no mês corrente e nos anteriores.
    const fixedThrough =
      year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const monthFixed = fixedExpenses.filter((f) => fixedAppliesToMonth(f, year, month))
      const fixedMonthly = monthFixed.reduce((s, f) => s + Number(f.amount), 0)
      const override = salaries.find((s) => s.month === month)
      // com receitas fixas cadastradas, o salário padrão deixa de contar sozinho
      const baseSalary = usingTemplates ? 0 : override ? Number(override.salary) : defaultSalary
      const monthIncomes = extraIncomes.filter((i) => i.month === month)
      const extra = monthIncomes.reduce((s, i) => s + Number(i.amount), 0)
      const virtualPending = incomeTemplates
        .filter(
          (t) =>
            templateAppliesToMonth(t, year, month) && !monthIncomes.some((i) => i.template_id === t.id),
        )
        .reduce((s, t) => s + Number(t.amount), 0)
      const incomeReceived =
        baseSalary +
        monthIncomes.filter((i) => i.received).reduce((s, i) => s + Number(i.amount), 0)
      const salary = baseSalary + extra + virtualPending
      const monthTx = transactions.filter((t) => t.month === month)
      const variableTotal = monthTx.reduce((s, t) => s + Number(t.amount), 0)
      const pendingTx = monthTx.filter((t) => !t.paid)
      const pendingFixed =
        month <= fixedThrough ? monthFixed.filter((f) => !isFixedPaid(f.id, month)) : []
      const spent = fixedMonthly + variableTotal
      return {
        month,
        salary,
        baseSalary,
        extra,
        incomeReceived,
        incomePending: salary - incomeReceived,
        fixedTotal: fixedMonthly,
        variableTotal,
        spent,
        remaining: salary - spent,
        pendingTotal:
          pendingTx.reduce((s, t) => s + Number(t.amount), 0) +
          pendingFixed.reduce((s, f) => s + Number(f.amount), 0),
        pendingCount: pendingTx.length + pendingFixed.length,
      }
    })
  }, [
    fixedExpenses,
    salaries,
    transactions,
    extraIncomes,
    incomeTemplates,
    usingTemplates,
    defaultSalary,
    isFixedPaid,
    year,
  ])

  const annual = useMemo(() => {
    const salary = summaries.reduce((s, m) => s + m.salary, 0)
    const spent = summaries.reduce((s, m) => s + m.spent, 0)
    const extra = summaries.reduce((s, m) => s + m.extra, 0)
    return {
      salary,
      extra,
      spent,
      remaining: salary - spent,
      fixedMonthly: summaries[0]?.fixedTotal ?? 0,
    }
  }, [summaries])

  return {
    loading,
    error,
    defaultSalary,
    lowBalanceAlert,
    fixedExpenses,
    fixedStatus,
    salaries,
    transactions,
    summaries,
    annual,
    extraIncomes,
    incomeTemplates,
    usingIncomeTemplates: usingTemplates,
    async addIncome(month, description, amount, opts) {
      const received = opts?.received ?? true
      const row = {
        user_id: DEMO ? 'demo' : userId,
        year,
        month,
        description,
        amount,
        received,
        received_on: received ? new Date().toISOString().slice(0, 10) : null,
        account_id: opts?.accountId ?? null,
        day: opts?.day ?? null,
        template_id: opts?.templateId ?? null,
      }
      if (DEMO) {
        const created = { ...row, id: demoId(), created_at: new Date().toISOString() }
        demoStore.extraIncomes.push(created)
        await syncIncomeMovement('demo', created)
        await reload()
        return
      }
      const { data, error } = await supabase.from('extra_incomes').insert(row).select('*').single()
      if (error) throw error
      await syncIncomeMovement(userId, data as ExtraIncome)
      await reload()
    },
    async updateIncome(id, patch) {
      if (DEMO) {
        const it = demoStore.extraIncomes.find((i) => i.id === id)
        if (it) {
          Object.assign(it, patch)
          await syncIncomeMovement('demo', it)
        }
        await reload()
        return
      }
      const { error } = await supabase.from('extra_incomes').update(patch).eq('id', id)
      if (error) throw error
      const cur = extraIncomes.find((i) => i.id === id)
      if (cur) await syncIncomeMovement(userId, { ...cur, ...patch })
      await reload()
    },
    async addTemplate(t) {
      if (DEMO) {
        const created: IncomeTemplate = {
          ...t,
          id: demoId(),
          user_id: 'demo',
          created_at: new Date().toISOString(),
        }
        demoStore.incomeTemplates.push(created)
        await reload()
        return created
      }
      const { data, error } = await supabase
        .from('income_templates')
        .insert({ user_id: userId, ...t })
        .select('*')
        .single()
      if (error) throw error
      await reload()
      return data as IncomeTemplate
    },
    async updateTemplate(id, patch) {
      if (DEMO) {
        const it = demoStore.incomeTemplates.find((x) => x.id === id)
        if (it) Object.assign(it, patch)
        await reload()
        return
      }
      const { error } = await supabase.from('income_templates').update(patch).eq('id', id)
      if (error) throw error
      await reload()
    },
    async removeTemplate(id) {
      if (DEMO) {
        demoStore.incomeTemplates = demoStore.incomeTemplates.filter((x) => x.id !== id)
        for (const i of demoStore.extraIncomes) if (i.template_id === id) i.template_id = null
        await reload()
        return
      }
      const { error } = await supabase.from('income_templates').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
    async removeIncome(id) {
      if (DEMO) {
        demoStore.extraIncomes = demoStore.extraIncomes.filter((i) => i.id !== id)
        demoStore.savingsMovements = demoStore.savingsMovements.filter((m) => m.income_id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('extra_incomes').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
    reload,
    isFixedPaid,
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
    async setLowBalanceAlert(value) {
      if (DEMO) {
        demoStore.lowBalanceAlert = value
        setLowBalance(value)
        return
      }
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, low_balance_alert: value, updated_at: new Date().toISOString() })
      if (error) throw error
      setLowBalance(value)
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
    async addFixed(name, amount, extra) {
      const row = {
        name,
        amount,
        active: true,
        category: extra?.category ?? null,
        method: extra?.method ?? null,
        bank: extra?.bank ?? null,
        note: extra?.note ?? null,
        start_year: extra?.startYear ?? null,
        start_month: extra?.startMonth ?? null,
        card_id: extra?.cardId ?? null,
      }
      if (DEMO) {
        demoStore.fixedExpenses.push({
          ...row,
          id: demoId(),
          user_id: 'demo',
          created_at: new Date().toISOString(),
        })
        await reload()
        return
      }
      const { error } = await supabase.from('fixed_expenses').insert({ user_id: userId, ...row })
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
        demoStore.fixedStatus = demoStore.fixedStatus.filter((s) => s.fixed_expense_id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
    async setFixedPaid(fixedExpenseId, month, paid) {
      if (DEMO) {
        const found = demoStore.fixedStatus.find(
          (s) => s.fixed_expense_id === fixedExpenseId && s.year === year && s.month === month,
        )
        if (found) found.paid = paid
        else
          demoStore.fixedStatus.push({
            user_id: 'demo',
            fixed_expense_id: fixedExpenseId,
            year,
            month,
            paid,
          })
        await reload()
        return
      }
      const { error } = await supabase.from('fixed_expense_status').upsert(
        { user_id: userId, fixed_expense_id: fixedExpenseId, year, month, paid },
        { onConflict: 'user_id,fixed_expense_id,year,month' },
      )
      if (error) throw error
      await reload()
    },
    async addTransaction(t) {
      const row = {
        user_id: DEMO ? 'demo' : userId,
        year,
        month: t.month,
        description: t.description,
        amount: t.amount,
        occurred_on: t.occurred_on,
        paid: t.paid ?? true,
        due_date: t.due_date ?? null,
        method: t.method ?? null,
        category: t.category ?? null,
        bank: t.bank ?? null,
        note: t.note ?? null,
        group_id: null,
        card_id: t.card_id ?? null,
        debit_account_id: t.debit_account_id ?? null,
        recurring_id: t.recurring_id ?? null,
      }
      if (DEMO) {
        const created = { ...row, id: demoId(), created_at: new Date().toISOString() }
        demoStore.transactions.push(created)
        await syncTxMovement('demo', created)
        await reload()
        return
      }
      const { data, error } = await supabase.from('transactions').insert(row).select('*').single()
      if (error) throw error
      await syncTxMovement(userId, data as Transaction)
      await reload()
    },
    async addInstallments(p) {
      const rows = buildInstallmentRows(DEMO ? 'demo' : userId, p)
      const addedThisYear = rows.filter((r) => r.year === year).length
      const addedNextYears = rows.length - addedThisYear
      if (DEMO) {
        for (const r of rows) {
          demoStore.transactions.push({ ...r, id: demoId(), created_at: new Date().toISOString() })
        }
        await reload()
        return { addedThisYear, addedNextYears }
      }
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      await reload()
      return { addedThisYear, addedNextYears }
    },
    async setPaidMany(ids, paid) {
      if (ids.length === 0) return
      if (DEMO) {
        for (const t of demoStore.transactions) {
          if (ids.includes(t.id)) {
            t.paid = paid
            await syncTxMovement('demo', t)
          }
        }
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').update({ paid }).in('id', ids)
      if (error) throw error
      for (const t of transactions.filter((x) => ids.includes(x.id) && x.debit_account_id)) {
        await syncTxMovement(userId, { ...t, paid })
      }
      await reload()
    },
    async loadMonthTransactions(y, m) {
      if (DEMO) return demoStore.transactions.filter((t) => t.year === y && t.month === m)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('year', y)
        .eq('month', m)
        .order('occurred_on')
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    async moveTransactions(moves) {
      if (moves.length === 0) return
      if (DEMO) {
        for (const mv of moves) {
          const t = demoStore.transactions.find((x) => x.id === mv.id)
          if (t) Object.assign(t, { year: mv.year, month: mv.month })
        }
        await reload()
        return
      }
      const results = await Promise.all(
        moves.map((mv) =>
          supabase.from('transactions').update({ year: mv.year, month: mv.month }).eq('id', mv.id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
      await reload()
    },
    async importTransactions(rows) {
      if (rows.length === 0) return 0
      if (DEMO) {
        for (const r of rows) {
          demoStore.transactions.push({
            ...r,
            id: demoId(),
            user_id: 'demo',
            created_at: new Date().toISOString(),
          })
        }
        await reload()
        return rows.length
      }
      const payload = rows.map((r) => ({ ...r, user_id: userId }))
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('transactions').insert(payload.slice(i, i + 200))
        if (error) throw error
      }
      await reload()
      return rows.length
    },
    async copyTransactions(rows, toYear, toMonth) {
      if (rows.length === 0) return 0
      const label = (d: string) => d.replace(/^\(adiada de [^)]*\)\s*/, '')
      const fresh = rows.map((src) => ({
        user_id: DEMO ? 'demo' : userId,
        year: toYear,
        month: toMonth,
        description: label(src.description),
        amount: src.amount,
        occurred_on: shiftDate(src.occurred_on, toYear, toMonth),
        // contas com vencimento voltam como "a pagar"; gasto do dia a dia mantém o status
        paid: src.due_date ? false : src.paid,
        due_date: src.due_date ? shiftDate(src.due_date, toYear, toMonth) : null,
        method: src.method,
        category: src.category,
        bank: src.bank,
        note: src.note,
        group_id: null,
        card_id: src.card_id,
        debit_account_id: src.debit_account_id,
        recurring_id: src.recurring_id,
      }))
      if (DEMO) {
        for (const r of fresh) {
          const created = { ...r, id: demoId(), created_at: new Date().toISOString() }
          demoStore.transactions.push(created)
          await syncTxMovement('demo', created)
        }
        await reload()
        return fresh.length
      }
      const { data, error } = await supabase.from('transactions').insert(fresh).select('*')
      if (error) throw error
      for (const t of (data ?? []) as Transaction[]) {
        if (t.debit_account_id) await syncTxMovement(userId, t)
      }
      await reload()
      return fresh.length
    },
    async setPaid(id, paid) {
      if (DEMO) {
        const it = demoStore.transactions.find((t) => t.id === id)
        if (it) {
          it.paid = paid
          await syncTxMovement('demo', it)
        }
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').update({ paid }).eq('id', id)
      if (error) throw error
      const cur = transactions.find((t) => t.id === id)
      if (cur) await syncTxMovement(userId, { ...cur, paid })
      await reload()
    },
    async updateTransaction(id, patch) {
      if (DEMO) {
        const it = demoStore.transactions.find((t) => t.id === id)
        if (it) {
          Object.assign(it, patch)
          await syncTxMovement('demo', it)
        }
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').update(patch).eq('id', id)
      if (error) throw error
      const cur = transactions.find((t) => t.id === id)
      if (cur) await syncTxMovement(userId, { ...cur, ...patch })
      await reload()
    },
    async postponeTransaction(id) {
      const tx = (DEMO ? demoStore.transactions : transactions).find((t) => t.id === id)
      if (!tx) return
      const { y, m } = nextMonth(tx.year, tx.month)
      const label = MONTHS_SHORT[tx.month - 1].toLowerCase()
      const patch = {
        year: y,
        month: m,
        occurred_on: shiftDate(tx.occurred_on, y, m),
        due_date: tx.due_date ? shiftDate(tx.due_date, y, m) : null,
        description: /^\(adiada de /.test(tx.description)
          ? tx.description
          : `(adiada de ${label}) ${tx.description}`,
      }
      if (DEMO) {
        Object.assign(tx, patch)
        await syncTxMovement('demo', tx)
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').update(patch).eq('id', id)
      if (error) throw error
      await syncTxMovement(userId, { ...tx, ...patch })
      await reload()
    },
    async restoreTransaction(tx) {
      if (DEMO) {
        demoStore.transactions.push({ ...tx })
        await syncTxMovement('demo', tx)
        await reload()
        return
      }
      const { error } = await supabase.from('transactions').insert({ ...tx })
      if (error) throw error
      await syncTxMovement(userId, tx)
      await reload()
    },
    async removeTransaction(id, groupId) {
      if (DEMO) {
        const before = demoStore.transactions.length
        const removed = demoStore.transactions.filter((t) =>
          groupId ? t.group_id === groupId : t.id === id,
        )
        demoStore.transactions = demoStore.transactions.filter((t) => !removed.includes(t))
        // no Supabase a retirada some em cascata; aqui na demo tira na mão
        const ids = new Set(removed.map((t) => t.id))
        demoStore.savingsMovements = demoStore.savingsMovements.filter(
          (m) => !m.transaction_id || !ids.has(m.transaction_id),
        )
        await reload()
        return before - demoStore.transactions.length
      }
      const q = supabase.from('transactions').delete()
      const { data, error } = groupId
        ? await q.eq('group_id', groupId).select('id')
        : await q.eq('id', id).select('id')
      if (error) throw error
      await reload()
      return data?.length ?? 1
    },
  }
}
