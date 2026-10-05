import { useEffect } from 'react'
import type { Transaction } from '../types'
import type { Invoice } from './invoices'
import { formatBRL, todayISO } from './format'

const KEY_ENABLED = 'planilha-reminders'
const KEY_SENT = 'planilha-reminders-sent'

export const remindersSupported = typeof window !== 'undefined' && 'Notification' in window

export function remindersEnabled(): boolean {
  try {
    return (
      remindersSupported &&
      Notification.permission === 'granted' &&
      localStorage.getItem(KEY_ENABLED) === '1'
    )
  } catch {
    return false
  }
}

/** Liga os lembretes: pede permissão ao navegador. Devolve se ficou ativo. */
export async function enableReminders(): Promise<boolean> {
  if (!remindersSupported) return false
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  const ok = perm === 'granted'
  try {
    localStorage.setItem(KEY_ENABLED, ok ? '1' : '0')
  } catch {
    /* sem storage: vale só nesta sessão */
  }
  return ok
}

export function disableReminders() {
  try {
    localStorage.setItem(KEY_ENABLED, '0')
  } catch {
    /* ignore */
  }
}

function addDays(iso: string, n: number): string {
  const d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Mensagens de lembrete: contas e faturas que vencem amanhã/hoje, e atrasadas. */
export function buildReminders(transactions: Transaction[], invoices: Invoice[], today: string): string[] {
  const tomorrow = addDays(today, 1)
  const bills = transactions.filter((t) => !t.paid && t.due_date && !t.card_id)
  const out: string[] = []
  const line = (label: string, list: { name: string; amount: number }[]) => {
    if (list.length === 0) return
    const total = list.reduce((s, x) => s + x.amount, 0)
    const names = list
      .slice(0, 3)
      .map((x) => x.name)
      .join(', ')
    out.push(`${label}: ${names}${list.length > 3 ? ` +${list.length - 3}` : ''} (${formatBRL(total)})`)
  }
  const asItems = (list: Transaction[]) => list.map((t) => ({ name: t.description, amount: Number(t.amount) }))
  const invItems = (list: Invoice[]) =>
    list.map((i) => ({ name: `fatura ${i.card.name}`, amount: i.total }))

  line('Vence amanhã', [
    ...asItems(bills.filter((t) => t.due_date!.slice(0, 10) === tomorrow)),
    ...invItems(invoices.filter((i) => i.dueDate === tomorrow)),
  ])
  line('Vence hoje', [
    ...asItems(bills.filter((t) => t.due_date!.slice(0, 10) === today)),
    ...invItems(invoices.filter((i) => i.dueDate === today)),
  ])
  line('Atrasada', [
    ...asItems(bills.filter((t) => t.due_date!.slice(0, 10) < today)),
    ...invItems(invoices.filter((i) => i.dueDate < today)),
  ])
  return out
}

async function notify(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, icon: '/pwa-192.png', tag: 'planilha-vencimentos' })
      return
    }
  } catch {
    /* cai no fallback */
  }
  new Notification(title, { body })
}

/**
 * Avisa (no máximo uma vez por dia e por conteúdo) quando algo vence amanhã/hoje ou está
 * atrasado. Funciona com o app aberto ou instalado em segundo plano; sem servidor de push
 * o navegador não acorda o app fechado.
 */
export function useDueReminders(enabled: boolean, transactions: Transaction[], invoices: Invoice[]) {
  useEffect(() => {
    if (!enabled || !remindersEnabled()) return
    function check() {
      const today = todayISO()
      const lines = buildReminders(transactions, invoices, today)
      if (lines.length === 0) return
      const signature = `${today}|${lines.join('|')}`
      try {
        if (localStorage.getItem(KEY_SENT) === signature) return
        localStorage.setItem(KEY_SENT, signature)
      } catch {
        /* sem storage: avisa mesmo assim */
      }
      void notify('Planilha de Gastos', lines.join('\n'))
    }
    check()
    const timer = window.setInterval(check, 30 * 60 * 1000)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, transactions, invoices])
}
