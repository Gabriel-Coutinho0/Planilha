const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatBRL(value: number): string {
  return brl.format(Number.isFinite(value) ? value : 0)
}

/** Le "1.234,56" ou "1234.56" ou "R$ 1.234,56" e devolve numero. */
export function parseAmount(input: string): number {
  if (!input) return 0
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return 0
  // Se tem virgula, assume formato pt-BR (ponto = milhar, virgula = decimal)
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

/** "2026-09-25" -> "25/09" (ou "25/09/26" com year=true). */
export function formatDate(iso: string | null, withYear = false): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return withYear ? `${d}/${m}/${y.slice(2)}` : `${d}/${m}`
}

/** Data ISO de hoje (YYYY-MM-DD) no fuso local. */
export function todayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export const MONTHS_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]
