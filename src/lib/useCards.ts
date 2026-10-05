import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import { fixedAppliesToMonth } from './fixedExpense'
import type { Card, FixedExpense, Transaction } from '../types'

export interface CardInput {
  name: string
  bank: string | null
  credit_limit: number
  closing_day: number
  due_day: number
}

export interface CardsData {
  loading: boolean
  error: string | null
  cards: Card[]
  /** Compras no cartão ainda não pagas, de qualquer mês/ano (parcelas futuras incluídas). */
  pendingTx: Transaction[]
  /** Gastos fixos cobrados no cartão e ainda não pagos neste mês. */
  pendingFixed: FixedExpense[]
  /** Quanto do limite está comprometido: compras e fixos do mês ainda não pagos. */
  usedOf: (cardId: string) => number
  /** Limite disponível = limite − usado. */
  availableOf: (card: Card) => number
  /** Avisar quando o uso do limite passar desse percentual. */
  alertPct: number
  setAlertPct: (value: number) => Promise<void>
  /** Marca gastos fixos de cartão como pagos no mês corrente. */
  payFixed: (ids: string[], paid?: boolean) => Promise<void>
  reload: () => Promise<void>
  addCard: (c: CardInput) => Promise<Card>
  updateCard: (id: string, patch: Partial<CardInput>) => Promise<void>
  removeCard: (id: string) => Promise<void>
}

/** `refreshKeys` mudam quando lançamentos/status mudam, pra recalcular o limite usado. */
export function useCards(
  userId: string,
  fixedExpenses: FixedExpense[],
  refreshKeys: unknown[],
): CardsData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [pendingTx, setPendingTx] = useState<Transaction[]>([])
  const [paidFixed, setPaidFixed] = useState<Set<string>>(new Set())
  const [alertPct, setAlertPctState] = useState(80)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const reload = useCallback(async () => {
    setError(null)
    if (DEMO) {
      setCards([...demoStore.cards])
      setPendingTx(demoStore.transactions.filter((t) => t.card_id && !t.paid))
      setPaidFixed(
        new Set(
          demoStore.fixedStatus
            .filter((s) => s.year === year && s.month === month && s.paid)
            .map((s) => s.fixed_expense_id),
        ),
      )
      setAlertPctState(demoStore.cardAlertPct)
      setLoading(false)
      return
    }
    try {
      const [c, tx, st, settings] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', userId).order('created_at'),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('paid', false)
          .not('card_id', 'is', null),
        supabase
          .from('fixed_expense_status')
          .select('fixed_expense_id')
          .eq('user_id', userId)
          .eq('year', year)
          .eq('month', month)
          .eq('paid', true),
        supabase.from('user_settings').select('card_alert_pct').eq('user_id', userId).maybeSingle(),
      ])
      if (c.error) throw c.error
      if (tx.error) throw tx.error
      if (st.error) throw st.error
      if (settings.error) throw settings.error
      setCards((c.data ?? []) as Card[])
      setPendingTx((tx.data ?? []) as Transaction[])
      setPaidFixed(new Set((st.data ?? []).map((r) => r.fixed_expense_id as string)))
      setAlertPctState(Number(settings.data?.card_alert_pct ?? 80))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cartões.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, year, month])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...refreshKeys])

  const pendingFixed = useMemo(
    () =>
      fixedExpenses.filter(
        (f) => f.card_id && fixedAppliesToMonth(f, year, month) && !paidFixed.has(f.id),
      ),
    [fixedExpenses, paidFixed, year, month],
  )

  const used = useMemo(() => {
    const u: Record<string, number> = {}
    for (const t of pendingTx) if (t.card_id) u[t.card_id] = (u[t.card_id] ?? 0) + Number(t.amount)
    for (const f of pendingFixed) if (f.card_id) u[f.card_id] = (u[f.card_id] ?? 0) + Number(f.amount)
    return u
  }, [pendingTx, pendingFixed])

  return {
    loading,
    error,
    cards,
    pendingTx,
    pendingFixed,
    usedOf: (id) => used[id] ?? 0,
    availableOf: (card) => Number(card.credit_limit) - (used[card.id] ?? 0),
    alertPct,
    async setAlertPct(value) {
      if (DEMO) {
        demoStore.cardAlertPct = value
        setAlertPctState(value)
        return
      }
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, card_alert_pct: value, updated_at: new Date().toISOString() })
      if (error) throw error
      setAlertPctState(value)
    },
    async payFixed(ids, paid = true) {
      if (ids.length === 0) return
      if (DEMO) {
        for (const id of ids) {
          const found = demoStore.fixedStatus.find(
            (s) => s.fixed_expense_id === id && s.year === year && s.month === month,
          )
          if (found) found.paid = paid
          else
            demoStore.fixedStatus.push({
              user_id: 'demo',
              fixed_expense_id: id,
              year,
              month,
              paid,
            })
        }
        await reload()
        return
      }
      const { error } = await supabase.from('fixed_expense_status').upsert(
        ids.map((id) => ({ user_id: userId, fixed_expense_id: id, year, month, paid })),
        { onConflict: 'user_id,fixed_expense_id,year,month' },
      )
      if (error) throw error
      await reload()
    },
    reload,
    async addCard(c) {
      if (DEMO) {
        const card: Card = {
          ...c,
          id: demoId(),
          user_id: 'demo',
          created_at: new Date().toISOString(),
        }
        demoStore.cards.push(card)
        await reload()
        return card
      }
      const { data, error } = await supabase
        .from('cards')
        .insert({ user_id: userId, ...c })
        .select('*')
        .single()
      if (error) throw error
      await reload()
      return data as Card
    },
    async updateCard(id, patch) {
      if (DEMO) {
        const it = demoStore.cards.find((c) => c.id === id)
        if (it) Object.assign(it, patch)
        await reload()
        return
      }
      const { error } = await supabase.from('cards').update(patch).eq('id', id)
      if (error) throw error
      await reload()
    },
    async removeCard(id) {
      if (DEMO) {
        demoStore.cards = demoStore.cards.filter((c) => c.id !== id)
        for (const t of demoStore.transactions) if (t.card_id === id) t.card_id = null
        for (const f of demoStore.fixedExpenses) if (f.card_id === id) f.card_id = null
        await reload()
        return
      }
      const { error } = await supabase.from('cards').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
