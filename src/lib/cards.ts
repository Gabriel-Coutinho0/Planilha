import type { Card, PaymentMethod, SavingsAccount } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Vencimento da fatura em que uma compra cai, dado o fechamento/vencimento do cartão. */
export function cardDueDate(card: Pick<Card, 'closing_day' | 'due_day'>, purchaseISO: string): string {
  const y = Number(purchaseISO.slice(0, 4))
  const m = Number(purchaseISO.slice(5, 7))
  const d = Number(purchaseISO.slice(8, 10))
  // compra no dia do fechamento (ou depois) entra na fatura seguinte
  let offset = m - 1 + (d >= card.closing_day ? 1 : 0)
  // vencimento antes/no fechamento = a fatura vence no mês seguinte ao do fechamento
  if (card.due_day <= card.closing_day) offset += 1
  const dy = y + Math.floor(offset / 12)
  const dm = (offset % 12) + 1
  const last = new Date(dy, dm, 0).getDate()
  return `${dy}-${pad(dm)}-${pad(Math.min(card.due_day, last))}`
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
