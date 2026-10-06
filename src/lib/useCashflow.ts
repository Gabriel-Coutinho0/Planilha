import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoStore } from './demoStore'
import type { IncomeRow, UnpaidTx } from './cashflow'

export interface CashflowSources {
  unpaidTx: UnpaidTx[]
  incomeRows: IncomeRow[]
  paidFixedNow: Set<string>
}

/**
 * Dados de todos os anos pro saldo mês a mês: lançamentos não pagos, receitas (a partir do ano
 * corrente) e os gastos fixos já pagos no mês corrente. `refreshKeys` mudam quando algo é editado.
 */
export function useCashflowSources(userId: string, refreshKeys: unknown[]): CashflowSources {
  const [src, setSrc] = useState<CashflowSources>({
    unpaidTx: [],
    incomeRows: [],
    paidFixedNow: new Set(),
  })
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (DEMO) {
        if (cancelled) return
        setSrc({
          unpaidTx: demoStore.transactions
            .filter((t) => !t.paid)
            .map((t) => ({
              year: t.year,
              month: t.month,
              amount: Number(t.amount),
              due_date: t.due_date,
              card_id: t.card_id,
            })),
          incomeRows: demoStore.extraIncomes
            .filter((i) => i.year >= y)
            .map((i) => ({
              year: i.year,
              month: i.month,
              amount: Number(i.amount),
              received: i.received,
              template_id: i.template_id,
              account_id: i.account_id,
            })),
          paidFixedNow: new Set(
            demoStore.fixedStatus
              .filter((s) => s.year === y && s.month === m && s.paid)
              .map((s) => s.fixed_expense_id),
          ),
        })
        return
      }
      const [tx, inc, st] = await Promise.all([
        supabase
          .from('transactions')
          .select('year, month, amount, due_date, card_id')
          .eq('user_id', userId)
          .eq('paid', false),
        supabase
          .from('extra_incomes')
          .select('year, month, amount, received, template_id, account_id')
          .eq('user_id', userId)
          .gte('year', y),
        supabase
          .from('fixed_expense_status')
          .select('fixed_expense_id')
          .eq('user_id', userId)
          .eq('year', y)
          .eq('month', m)
          .eq('paid', true),
      ])
      if (cancelled || tx.error || inc.error || st.error) return
      setSrc({
        unpaidTx: (tx.data ?? []).map((t) => ({
          year: t.year as number,
          month: t.month as number,
          amount: Number(t.amount),
          due_date: (t.due_date as string | null) ?? null,
          card_id: (t.card_id as string | null) ?? null,
        })),
        incomeRows: (inc.data ?? []).map((i) => ({
          year: i.year as number,
          month: i.month as number,
          amount: Number(i.amount),
          received: i.received as boolean,
          template_id: (i.template_id as string | null) ?? null,
          account_id: (i.account_id as string | null) ?? null,
        })),
        paidFixedNow: new Set((st.data ?? []).map((r) => r.fixed_expense_id as string)),
      })
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, y, m, ...refreshKeys])

  return src
}
