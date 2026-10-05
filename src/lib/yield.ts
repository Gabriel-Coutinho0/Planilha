import type { SavingsMovement } from '../types'

/** Dias úteis (seg–sex) em (from, to]. Não considera feriados. */
export function businessDaysBetween(fromISO: string, toISO: string): number {
  const from = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10))
  const to = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10))
  if (to <= from) return 0
  const days = Math.round((to - from) / 86400000)
  const fullWeeks = Math.floor(days / 7)
  let count = fullWeeks * 5
  const startDow = new Date(from).getUTCDay()
  for (let i = 1; i <= days - fullWeeks * 7; i++) {
    const dow = (startDow + fullWeeks * 7 + i) % 7
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

/** Fator de rendimento por dia útil: CDI anual (%) × percentual do CDI (%), 252 dias úteis/ano. */
export function dailyFactor(cdiAnnualPct: number, cdiPercent: number): number {
  const di = Math.pow(1 + cdiAnnualPct / 100, 1 / 252) - 1
  return 1 + di * (cdiPercent / 100)
}

/**
 * Saldo estimado: cada depósito/retirada rende (juros compostos, dias úteis) desde a sua
 * data até hoje. Sem percentual, é só a soma simples.
 */
export function estimatedBalance(
  movements: SavingsMovement[],
  cdiAnnualPct: number,
  cdiPercent: number | null,
  today: string,
): { principal: number; balance: number } {
  let principal = 0
  let balance = 0
  const f = cdiPercent ? dailyFactor(cdiAnnualPct, cdiPercent) : 1
  for (const m of movements) {
    const signed = m.kind === 'deposito' ? Number(m.amount) : -Number(m.amount)
    principal += signed
    balance += cdiPercent
      ? signed * Math.pow(f, businessDaysBetween(m.occurred_on.slice(0, 10), today))
      : signed
  }
  return { principal, balance }
}
