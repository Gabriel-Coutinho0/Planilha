import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO } from './demo'
import { demoId, demoStore } from './demoStore'
import type { Notice } from '../types'

export interface NoticesData {
  loading: boolean
  error: string | null
  notices: Notice[]
  reload: () => Promise<void>
  addNotice: (text: string) => Promise<void>
  removeNotice: (id: string) => Promise<void>
}

export function useNotices(userId: string): NoticesData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (DEMO) {
      setNotices([...demoStore.notices])
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotices((data ?? []) as Notice[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar avisos.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    loading,
    error,
    notices,
    reload,
    async addNotice(text) {
      if (DEMO) {
        demoStore.notices.unshift({
          id: demoId(),
          user_id: 'demo',
          text,
          created_at: new Date().toISOString(),
        })
        await reload()
        return
      }
      const { error } = await supabase.from('notices').insert({ user_id: userId, text })
      if (error) throw error
      await reload()
    },
    async removeNotice(id) {
      if (DEMO) {
        demoStore.notices = demoStore.notices.filter((n) => n.id !== id)
        await reload()
        return
      }
      const { error } = await supabase.from('notices').delete().eq('id', id)
      if (error) throw error
      await reload()
    },
  }
}
