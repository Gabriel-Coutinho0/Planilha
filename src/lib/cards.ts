import { useSyncExternalStore } from 'react'
import type { Card, PaymentMethod, SavingsAccount } from '../types'

/** Como contar o "mês da fatura": pelo mês em que ela fecha, ou pelo mês em que vence. */
export type InvoiceBasis = 'closing' | 'due'

let invoiceBasis: InvoiceBasis = 'closing'
const basisListeners = new Set<() => void>()

export function setInvoiceBasis(b: InvoiceBasis) {
  if (b === invoiceBasis) return
  invoiceBasis = b
  basisListeners.forEach((l) => l())
}

export function useInvoiceBasis(): InvoiceBasis {
  return useSyncExternalStore(
    (l) => {
      basisListeners.add(l)
      return () => {
        basisListeners.delete(l)
      }
    },
    () => invoiceBasis,
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

type CycleCard = Pick<Card, 'closing_day' | 'due_day'> & { closing_offset?: number | null }

const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

function addDays(iso: string, n: number): string {
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** Texto do fechamento do cartão ("dia 25" ou "7 dias antes do vencimento"). */
export function closingLabel(card: CycleCard): string {
  return card.closing_offset ? `${card.closing_offset} dias antes do vencimento` : `dia ${card.closing_day}`
}

/**
 * Fatura em que uma compra cai: data de fechamento e de vencimento.
 * - Fechamento em dia fixo: compra a partir desse dia vai pra fatura seguinte.
 * - Fechamento "N dias antes do vencimento" (ex.: Nubank, 7 dias): o fechamento acompanha o mês
 *   (24 ou 25 conforme o tamanho do mês). A compra cai na primeira fatura que ainda não fechou;
 *   compra no dia do fechamento vai pra seguinte.
 */
export function cardCycle(card: CycleCard, purchaseISO: string): { dueDate: string; closingDate: string } {
  const y = Number(purchaseISO.slice(0, 4))
  const m = Number(purchaseISO.slice(5, 7))
  const d = Number(purchaseISO.slice(8, 10))

  if (card.closing_offset && card.closing_offset > 0) {
    for (let k = -1; k <= 3; k++) {
      const off = m - 1 + k
      const dy = y + Math.floor(off / 12)
      const dm = (((off % 12) + 12) % 12) + 1
      const dueDate = ymd(dy, dm, Math.min(card.due_day, lastDayOf(dy, dm)))
      const closingDate = addDays(dueDate, -card.closing_offset)
      if (purchaseISO.slice(0, 10) < closingDate) return { dueDate, closingDate }
    }
  }

  // dia fixo: compra no dia do fechamento (ou depois) entra na fatura seguinte
  const co = m - 1 + (d >= card.closing_day ? 1 : 0)
  const cy = y + Math.floor(co / 12)
  const cm = (co % 12) + 1
  const closingDate = ymd(cy, cm, Math.min(card.closing_day, lastDayOf(cy, cm)))
  // vencimento antes/no fechamento = a fatura vence no mês seguinte ao do fechamento
  const vo = co + (card.due_day <= card.closing_day ? 1 : 0)
  const vy = y + Math.floor(vo / 12)
  const vm = (vo % 12) + 1
  return { dueDate: ymd(vy, vm, Math.min(card.due_day, lastDayOf(vy, vm))), closingDate }
}

/**
 * Mês da fatura em que a compra cai. Por padrão, o mês em que essa fatura FECHA (cartão que fecha
 * dia 25: compra de 24/09 é a fatura de setembro; de 25/09, a de outubro). Com a configuração
 * "mês do vencimento", é o mês em que ela VENCE (pra quem pensa "fatura de novembro = a que pago em novembro").
 */
export function cardStatementMonth(card: CycleCard, purchaseISO: string): { year: number; month: number } {
  const cycle = cardCycle(card, purchaseISO)
  const c = invoiceBasis === 'due' ? cycle.dueDate : cycle.closingDate
  return { year: Number(c.slice(0, 4)), month: Number(c.slice(5, 7)) }
}

/** Vencimento da fatura em que uma compra cai, dado o fechamento/vencimento do cartão. */
export function cardDueDate(card: CycleCard, purchaseISO: string): string {
  return cardCycle(card, purchaseISO).dueDate
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Conta bancária de onde um lançamento sai do saldo: precisa ter banco, não ser
 * cartão de crédito e existir uma conta (tipo "conta") com esse nome/banco.
 */
export function findDebitAccount(
  accounts: SavingsAccount[],
  bank: string | null | undefined,
  method: PaymentMethod | '' | null | undefined,
): SavingsAccount | null {
  const b = norm(bank)
  if (!b || method === 'cartao') return null
  const contas = accounts.filter((a) => a.kind === 'conta')
  return (
    contas.find((a) => norm(a.name) === b) ?? contas.find((a) => norm(a.institution) === b) ?? null
  )
}
