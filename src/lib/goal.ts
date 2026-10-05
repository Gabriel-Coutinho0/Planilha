import type { SavingsAccount } from '../types'

export interface GoalInfo {
  target: number
  pct: number
  remaining: number
  /** Meses que faltam até a data (mínimo 1). null se não há data. */
  months: number | null
  /** Quanto guardar por mês pra chegar lá. null se não há data ou já bateu a meta. */
  perMonth: number | null
  reached: boolean
  /** Data já passou e a meta não foi batida. */
  late: boolean
}

export function goalInfo(a: SavingsAccount, balance: number, today: Date = new Date()): GoalInfo | null {
  const target = Number(a.goal_amount ?? 0)
  if (!target || target <= 0) return null
  const remaining = Math.max(0, target - balance)
  const reached = balance >= target
  let months: number | null = null
  let late = false
  if (a.goal_date) {
    const y = +a.goal_date.slice(0, 4)
    const m = +a.goal_date.slice(5, 7)
    const raw = (y - today.getFullYear()) * 12 + (m - 1 - today.getMonth())
    late = raw < 0 && !reached
    months = Math.max(1, raw + 1) // inclui o mês atual
  }
  return {
    target,
    pct: Math.min(1, Math.max(0, balance / target)),
    remaining,
    months,
    perMonth: months != null && !reached ? remaining / months : null,
    reached,
    late,
  }
}
