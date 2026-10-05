import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { Card } from '../types'

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
  /** Quanto do limite está comprometido: compras no cartão ainda não pagas (de qualquer mês/ano). */
  usedOf: (cardId: string) => number
  /** Limite disponível = limite − usado. */
  availableOf: (card: Card) => number
  reload: () => Promise<void>
  addCard: (c: CardInput) => Promise<Card>
  updateCard: (id: string, patch: Partial<CardInput>) => Promise<void>
  removeCard: (id: string) => Promise<void>
}

/** `refreshKey` muda quando os lançamentos mudam, pra recalcular o limite usado. */
export function useCards(userId: string, refreshKey: unknown): CardsData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [used, setUsed] = useState<Record<string, number>>({})

  const reload = useCallback(async () => {
    setError(null)
    if (DEMO) {
      setCards([...demoStore.cards])
      const u: Record<string, number> = {}
      for (const t of demoStore.transactions) {
        if (t.card_id && !t.paid) u[t.card_id] = (u[t.card_id] ?? 0) + Number(t.amount)
      }
      setUsed(u)
      setLoading(false)
      return
    }
    try {
      const [c, tx] = await Promise.all([
        supabase.from('cards').select('*').eq('user_id', userId).order('created_at'),
        supabase
          .from('transactions')
          .select('card_id, amount')
          .eq('user_id', userId)
          .eq('paid', false)
          .not('card_id', 'is', null),
      ])
      if (c.error) throw c.error
      if (tx.error) throw tx.error
      setCards((c.data ?? []) as Card[])
      const u: Record<string, number> = {}
      for (const t of (tx.data ?? []) as { card_id: string; amount: number }[]) {
        u[t.card_id] = (u[t.card_id] ?? 0) + Number(t.amount)
      }
      setUsed(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar cartões.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  return {
    loading,
    error,
    cards,
    usedOf: (id) => used[id] ?? 0,
    availableOf: (card) => Number(card.credit_limit) - (used[card.id] ?? 0),
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
        await reload()
        return
      }
      const { error } = await supabase.from('cards').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
